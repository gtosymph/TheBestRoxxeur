/**
 * Fil de calcul du solveur, cote navigateur.
 *
 * Le fil travaille par vagues : chaque vague enchaine quelques dizaines de
 * generations, puis rend la main un instant. Cette pause laisse passer les
 * messages du fil principal : l'ordre d'arret et les genomes migrants venus
 * des autres fils. La recherche continue tant que l'ordre d'arret n'arrive pas.
 */
import { loadCatalog } from './catalog-web.mjs';
import { normalizePassives } from '../src/data/passives.mjs';
import { normaliserExos } from '../src/engine/exos.mjs';
import { STAT_KEYS } from '../src/data/stats.mjs';
import { preparerRecherche, solve } from '../src/solver/genetic.mjs';
import { creerArchive } from '../src/solver/candidates.mjs';
import { reposApresVague } from '../src/solver/intensite.mjs';
import { fusionnerPaliers, GENERATIONS_PAR_VAGUE, optionsDeVague, parCle } from './vagues.mjs';
import {
  aConditionDAxe, AXE_XP, axeDe, lireAxe, objectifDeTranche,
  trancheDe, tranchesAVisiter,
} from '../src/solver/survie.mjs';

/**
 * Une vague sur ce nombre part explorer une tranche de vie sous le gagnant.
 *
 * La recherche ordinaire ne descend jamais sous la condition de vie : un
 * build qui lache la vie pour frapper plus fort est penalise et disparait.
 * La courbe « degats ou survie » a pourtant besoin de ces builds, et une
 * descente locale reste dix pour cent sous ce que le moteur genetique trouve.
 * Une vague dediee, sous un plafond de vie, lui rend sa pleine force.
 */
const VAGUES_PAR_TRANCHE = 4;

/** Tranches visitees sous celle du gagnant, en tournant. */
const TRANCHES_VISITEES = 4;

/** Le catalogue ne se charge qu'une fois par fil. */
let catalogPromise = null;

/** Vrai quand le fil principal a demande l'arret. */
let arretDemande = false;

/** Genomes recus des autres fils, injectes a la prochaine vague. */
let migrants = [];

/** Resume compact d'un resultat de vague, pour le fil principal. */
function resumer(result) {
  return {
    score: result.score,
    itemIds: result.items.map((item) => item.id),
    allocation: result.allocation,
    stats: result.stats,
    penalty: result.detail.penalty,
    damage: result.detail.damage,
    satisfied: result.detail.satisfied,
    unmet: result.detail.unmet,
    // Exos rares que le solveur a poses lui-meme, s'il en avait le droit.
    exos: result.exos ?? [],
  };
}

/** Laisse le fil traiter ses messages, le temps que l'intensite demande. */
function reposer(departVague, intensite) {
  const repos = reposApresVague(Date.now() - departVague, intensite);
  return new Promise((resolve) => { setTimeout(resolve, repos); });
}

/** Ce que toutes les vagues d'une demande partagent. */
function baseDeRecherche(request, catalog) {
  const { passives } = normalizePassives(request.passivesConfig, new Set(STAT_KEYS));
  const exos = normaliserExos(request.exosConfig, new Set(STAT_KEYS));

  return {
    items: catalog.items,
    setById: catalog.setById,
    level: request.level,
    scrolls: request.scrolls,
    passives,
    exos,
    profile: request.profile,
    banned: new Set(request.bannedIds ?? []),
    lockedIds: request.lockedIds ?? [],
    seedItems: (request.currentItemIds ?? [])
      .map((id) => catalog.itemById.get(id))
      .filter(Boolean),
    allowedSlots: request.allowedSlots ? new Set(request.allowedSlots) : null,
    objective: request.objective,
  };
}

/**
 * Tout ce qu'une recherche garde d'une vague a l'autre.
 *
 * C'est l'accumulateur du fil : il change en place a chaque vague, et ne sort
 * jamais du fil que par les messages.
 */
function creerMemoire(request, catalog) {
  const base = baseDeRecherche(request, catalog);
  // L'axe suit le mode : tranches d'endurance en mode degats, tranches de
  // degats en mode endurance.
  const axe = axeDe(request.objective?.mode);
  return {
    base,
    axe,
    // En mode « Monter », l'echange existe toujours : le score EST un produit
    // entre les degats et la sagesse. Les autres axes n'ont de compromis a
    // montrer que si le joueur a pose la condition qui les borne.
    survieUtile: axe === AXE_XP || aConditionDAxe(request.objective, axe),
    // La demande ne bouge pas d'une vague a l'autre : pools, verrous,
    // classements et cache d'evaluation se preparent une seule fois. Le
    // classement des pieces coute a lui seul un dixieme du temps d'une vague.
    contexte: preparerRecherche(base),
    // Les candidats se cumulent sur toute la recherche : chaque vague repart
    // avec une archive neuve, celle-ci garde la memoire de toutes les vagues.
    archive: creerArchive({ identite: (ids) => [...ids].sort((a, b) => a - b) }),
    // Les paliers de proximite, puis ceux de survie : pour chaque palier, le
    // build le plus fort vu au fil des vagues.
    paliers: new Map(),
    survie: new Map(),
    // Contexte et graines propres a chaque tranche visitee : ils se preparent
    // une fois et se gardent d'une visite a l'autre.
    tranches: new Map(),
    allocation: request.allocation ?? {},
    graines: [],
    totalGenerations: 0,
    meilleur: null,
    vague: 0,
    visites: 0,
  };
}

/**
 * Explore une tranche de vie sous le gagnant : une vague ordinaire, sous un
 * autre objectif. Seuls ses paliers de survie reviennent ; son gagnant ne
 * repond pas a la demande du joueur et ne touche ni au personnage ni aux
 * candidats.
 */
function explorerTranche(memoire, request, tranche) {
  const { base, axe, tranches } = memoire;
  if (!tranches.has(tranche)) {
    const objective = objectifDeTranche(request.objective, tranche, axe.pas, axe);
    tranches.set(tranche, {
      objective, contexte: preparerRecherche({ ...base, objective }), graines: [], allocation: {},
    });
  }
  const piste = tranches.get(tranche);

  const result = solve(
    { ...base, objective: piste.objective, allocation: piste.allocation, contexte: piste.contexte,
      seedGenomes: [...memoire.graines, ...piste.graines] },
    optionsDeVague(request.options, request.seed + 104729 * (memoire.visites + 1)),
  );
  piste.graines = result.topGenomes;
  piste.allocation = result.allocation ?? piste.allocation;

  // Ce qui se trouve sous le plafond sert aussi la recherche principale :
  // un build qui tient la condition de vie de justesse y passe parfois
  // mieux que par le chemin ordinaire. Ses meilleurs genomes rejoignent
  // les migrants, la prochaine vague les juge sur le vrai objectif.
  migrants.push(...result.topGenomes.slice(0, 4));

  fusionnerPaliers(memoire.survie, result.survie, { cle: 'tranche', valeur: axe.valeur });
}

/** La tranche a explorer a cette vague, ou null pour une vague ordinaire. */
function trancheDeLaVague(memoire) {
  const { survieUtile, meilleur, vague, axe, visites } = memoire;
  // Une vague sur quatre part sous le gagnant, des qu'un gagnant existe.
  if (!survieUtile || !meilleur || vague % VAGUES_PAR_TRANCHE !== VAGUES_PAR_TRANCHE - 1) return null;
  const courant = lireAxe(meilleur, axe.cle);
  const aVisiter = tranchesAVisiter(trancheDe(courant, axe.pas), TRANCHES_VISITEES);
  return aVisiter.length > 0 ? aVisiter[visites % aVisiter.length] : null;
}

/** Une vague sur le vrai objectif du joueur, et son compte rendu au fil principal. */
function vaguePrincipale(memoire, request, apports) {
  const debut = memoire.totalGenerations;
  const result = solve(
    { ...memoire.base, allocation: memoire.allocation,
      seedGenomes: [...memoire.graines, ...apports], contexte: memoire.contexte },
    optionsDeVague(request.options, request.seed + memoire.vague * 7919),
    (progress) => {
      if ((debut + progress.generation) % 5 === 0) {
        self.postMessage({
          type: 'progress', seed: request.seed,
          generation: debut + progress.generation, best: progress.best,
        });
      }
    },
  );

  memoire.totalGenerations += GENERATIONS_PAR_VAGUE;
  memoire.graines = result.topGenomes;
  memoire.allocation = result.allocation ?? memoire.allocation;

  for (const candidat of result.candidats ?? []) {
    memoire.archive.proposer(candidat.itemIds, candidat.score, candidat);
  }
  fusionnerPaliers(memoire.paliers, result.paliers, { cle: 'changements', valeur: 'score' });
  fusionnerPaliers(memoire.survie, result.survie, { cle: 'tranche', valeur: memoire.axe.valeur });

  const resume = resumer(result);
  if (!memoire.meilleur || resume.score > memoire.meilleur.score) memoire.meilleur = resume;

  /*
   * La vague porte les paliers, pas seulement le score.
   *
   * Le trace « degats ou survie » se construit a partir d'eux. Tant qu'ils
   * n'arrivaient qu'a la fin, la courbe restait celle de la recherche
   * PRECEDENTE pendant toute la nouvelle : le joueur lancait, attendait
   * plusieurs minutes, et ne voyait rien bouger.
   *
   * Ce sont deux frontieres, une entree par tranche : quelques dizaines de
   * lignes, envoyees une fois par seconde et par fil. L'archive des
   * candidats, elle, reste pour la fin — elle n'a pas de taille promise.
   */
  self.postMessage({
    type: 'vague',
    seed: request.seed,
    generation: memoire.totalGenerations,
    best: memoire.meilleur.score,
    // La premiere valeur d'une vague repete la derniere de la precedente.
    history: memoire.vague === 0 ? result.history : result.history.slice(1),
    resume,
    paliers: parCle(memoire.paliers, 'changements'),
    survie: parCle(memoire.survie, 'tranche'),
    topGenomes: result.topGenomes.slice(0, 4),
  });
}

async function chercher(request) {
  catalogPromise ??= loadCatalog();
  const memoire = creerMemoire(request, await catalogPromise);

  while (!arretDemande) {
    const apports = migrants.splice(0, 8);
    const departVague = Date.now();

    const tranche = trancheDeLaVague(memoire);
    if (tranche === null) {
      vaguePrincipale(memoire, request, apports);
    } else {
      explorerTranche(memoire, request, tranche);
      memoire.visites += 1;
    }
    memoire.vague += 1;
    // La pause laisse le fil traiter l'ordre d'arret et les migrants. Sa
    // duree suit l'intensite demandee : c'est elle qui menage le processeur.
    await reposer(departVague, request.intensite);
  }

  self.postMessage({
    type: 'done',
    seed: request.seed,
    generations: memoire.totalGenerations,
    candidats: memoire.archive.liste().map((entree) => entree.detail),
    paliers: parCle(memoire.paliers, 'changements'),
    survie: parCle(memoire.survie, 'tranche'),
    ...(memoire.meilleur ?? { score: Number.NEGATIVE_INFINITY }),
  });
}

self.addEventListener('message', (event) => {
  const message = event.data;

  if (message.type === 'stop') { arretDemande = true; return; }
  if (message.type === 'migrants') { migrants.push(...(message.genomes ?? [])); return; }

  if (message.type === 'start') {
    arretDemande = false;
    migrants = [];
    chercher(message.request).catch((error) => {
      self.postMessage({ type: 'error', seed: message.request?.seed, message: error.message });
    });
  }
});
