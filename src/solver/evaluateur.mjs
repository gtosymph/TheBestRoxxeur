/**
 * L'evaluation d'un genome : decoder, calculer le build, noter.
 *
 * Le solveur genetique et la recherche locale passent tous deux par ici. Les
 * penalites vivent avec l'evaluateur : ce sont elles qui gardent un chemin
 * d'amelioration aux builds qui ne tiennent pas encore leurs conditions.
 */
import { computeBuild } from '../engine/build.mjs';
import { weaponAttack } from '../engine/damage.mjs';
import { maxViolations, scoreBuild } from './score.mjs';
import { decode } from './genome.mjs';
import { createIncrementalBuild } from './incremental.mjs';
import { creerCompteur, normaliserProximite } from './proximite.mjs';

/**
 * Penalite appliquee par item dont les conditions d'equipement ne sont pas
 * remplies. Elle reste finie pour garder un gradient : un build qui porte un
 * seul item interdit doit pouvoir evoluer vers un build valide.
 */
export const INVALID_ITEM_PENALTY = 1e6;

/**
 * Penalite appliquee par maximum absolu franchi. Elle reste finie pour la
 * meme raison que la penalite d'item interdit : le solveur doit garder un
 * chemin d'amelioration.
 */
export const MAX_VIOLATION_PENALTY = 1e6;

/**
 * Penalite par piece a changer au-dela de la limite demandee.
 *
 * Elle reste finie, et plus faible que les autres : un build qui change une
 * piece de trop doit pouvoir evoluer vers un build conforme, et un build
 * conforme mais irrealisable reste pire qu'un build simplement trop cher.
 */
export const CHANGEMENT_PENALTY = 1e5;

/**
 * Nombre maximal de resultats gardes par le cache d'evaluation.
 * L'eviction retire l'entree la plus ancienne (ordre d'insertion du Map).
 */
const CACHE_EVALUATIONS = 4096;

/** Options de score de la boucle chaude : pas de detail par condition. */
const SANS_DETAILS = Object.freeze({ details: false });

/** Options de score des resultats rendus : detail complet. */
const AVEC_DETAILS = Object.freeze({ details: true });

/**
 * Prepare la fonction d'evaluation d'un genome.
 *
 * L'evaluation passe par un cache par genome : les elites et les doublons
 * reviennent souvent d'une generation a l'autre. Le cache DOIT etre vide par
 * `evaluate.invalidate()` quand la repartition des points change, sans quoi
 * il rendrait des scores perimes.
 *
 * `evaluate.incremental()` cree un evaluateur par delta pour la recherche
 * locale : `noter(genome)` rend le meme resultat que `evaluate(genome)`,
 * `rebaser(genome)` fige la base des deltas.
 *
 * @param {object} context
 * @returns {(genome: number[]) => {score: number, stats: any, detail: any}}
 */
export function createEvaluator({
  pools, setById, level, porteur, scrolls, passives, profile, objective, exos = null,
}) {
  // Le budget d'exos libres voyage dans l'objectif, comme la menace : il dit
  // ce que la recherche a le droit de faire, pas ce que le personnage porte.
  const exosLibres = objective?.exosLibres ?? null;
  // L'attaque d'une arme se construit une seule fois par arme rencontree.
  const attaques = new Map();

  // Proximite avec le stuff porte en jeu : le compteur se prepare une fois,
  // la boucle chaude ne fait plus que compter.
  const proximite = normaliserProximite(objective.proximite);
  const compterChangements = proximite ? creerCompteur(proximite) : null;
  const spellsAvecArme = (items) => {
    const spells = objective.spells ?? [];
    if (!objective.useWeapon) return spells;
    const arme = items.find((item) => item.slot === 'arme');
    if (!arme) return spells;
    if (!attaques.has(arme.id)) {
      attaques.set(arme.id, weaponAttack(arme, { maitrise: objective.maitriseArme !== false }));
    }
    const attaque = attaques.get(arme.id);
    return attaque ? [...spells, attaque] : spells;
  };

  // Note un build deja agrege : score des sorts et penalites.
  // « details » reste faux : la boucle ne lit que le score, et le detail par
  // condition coutait un objet par condition et par evaluation.
  const noterBuild = (items, stats, invalid, options = SANS_DETAILS) => {
    const spells = spellsAvecArme(items);
    // Sans arme comptee, l'objectif passe tel quel : une copie par evaluation
    // pour rien pesait sur le ramasse-miettes.
    const cible = spells === objective.spells ? objective : { ...objective, spells };
    const detail = scoreBuild(stats, cible, options);
    const violations = maxViolations(objective.conditions, stats, detail.damage);

    // Pieces a acheter pour porter ce build. Le compte sert deux fois : il
    // penalise ce qui depasse la limite, et il range le build dans son palier.
    const changements = compterChangements
      ? compterChangements(idsDe(items))
      : 0;
    const enTrop = proximite ? Math.max(0, changements - proximite.max) : 0;

    // Un item interdit ou un maximum franchi rend le build irrealisable en jeu.
    const score = detail.score
      - invalid.length * INVALID_ITEM_PENALTY
      - violations.length * MAX_VIOLATION_PENALTY
      - enTrop * CHANGEMENT_PENALTY;

    return { score, stats, detail, items, invalid, violations, changements };
  };

  const cache = new Map();

  const evaluate = function evaluate(genome) {
    const cle = genome.join(',');
    const connu = cache.get(cle);
    if (connu) return connu;

    const items = decode(genome, pools);
    const { stats, invalid } = computeBuild(
      { items, level, allocation: porteur.allocation, scrolls, passives, profile,
        menace: objective?.menace, exos, exosLibres }, setById,
    );
    const resultat = noterBuild(items, stats, invalid);

    if (cache.size >= CACHE_EVALUATIONS) cache.delete(cache.keys().next().value);
    cache.set(cle, resultat);
    return resultat;
  };

  // Les resultats rendus a l'appelant portent le detail par condition, que la
  // boucle ne calcule pas. Le cache garde la version allegee : ce chemin la
  // contourne, il ne sert qu'une poignee de fois par recherche.
  evaluate.complet = (genome, allocation = porteur.allocation) => {
    const items = decode(genome, pools);
    const { stats, invalid, exos: places } = computeBuild(
      { items, level, allocation, scrolls, passives, profile, menace: objective?.menace,
        exos, exosLibres }, setById,
    );
    // Les exos que le solveur a poses lui-meme se rendent avec le build : le
    // joueur doit lire « avec un exo PA sur la ceinture », pas le deviner.
    return { ...noterBuild(items, stats, invalid, AVEC_DETAILS), exos: places };
  };

  evaluate.invalidate = () => { cache.clear(); };
  evaluate.incremental = () => {
    const delta = createIncrementalBuild({
      pools, setById, level, porteur, scrolls, passives, profile, menace: objective?.menace,
      exos, exosLibres,
    });
    return {
      noter: (genome) => {
        const { stats, items, invalid } = delta.calculer(genome);
        return noterBuild(items, stats, invalid);
      },
      rebaser: (genome) => delta.rebaser(genome),
    };
  };
  evaluate.spellsAvecArme = spellsAvecArme;
  evaluate.proximite = proximite;
  return evaluate;
}

/**
 * Identifiants des pieces d'un build, cases vides ecartees.
 * @param {any[]} items
 * @returns {number[]}
 */
function idsDe(items) {
  const ids = [];
  for (const item of items) if (item) ids.push(item.id);
  return ids;
}
