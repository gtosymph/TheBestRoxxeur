/**
 * Transition du stuff actuel vers un stuff cible.
 *
 * Le joueur connait le stuff qu'il vise, mais il l'achete par morceaux. Chaque
 * etape du plan doit tenir ses conditions (12 PA, 5 PM, 600 sagesse...) : un
 * stuff intermediaire qui les casse ne sert pas en combat. La V1 ne propose
 * aucune piece de passage, parce qu'acheter puis revendre coute du temps et
 * des kamas. Une piece cible peut s'acheter et dormir en banque : c'est ce qui
 * rend un plan sans piece de passage toujours possible.
 *
 * La methode : les cases qui different forment au plus seize changements.
 * Chaque sous-ensemble est un stuff intermediaire, que le moteur juge une
 * seule fois. Depuis le stuff equipe, l'etape suivante est le plus petit
 * groupe de changements qui garde les conditions, et parmi ces groupes, celui
 * qui rapporte le plus par kama. Une piece achetee ne se revend jamais : le
 * plan ne fait qu'ajouter des changements.
 */
import { computeBuild } from '../engine/build.mjs';
import { SLOTS } from '../data/slots.mjs';
import { maxViolations, scoreBuild } from './score.mjs';

const SANS_DETAILS = Object.freeze({ details: false });

/** Etat d'un stuff intermediaire dans le cache. */
const INCONNU = 0;
const VALIDE = 1;
const INVALIDE = 2;

/**
 * Apparie les pieces qui different, case par case.
 *
 * Une piece presente des deux cotes ne change pas, quelle que soit sa case :
 * deplacer un anneau ne coute rien. Le reste s'apparie dans l'ordre ; ce qui
 * n'a pas de vis-a-vis devient un ajout ou une piece enlevee.
 *
 * @param {any[]} actuel
 * @param {any[]} cible
 * @returns {{slot: string, sortante: any|null, entrante: any|null}[]}
 */
export function apparier(actuel, cible) {
  const changements = [];
  for (const { key } of SLOTS) {
    const restantes = cible.filter((item) => item?.slot === key);
    const sortantes = [];
    for (const item of actuel.filter((piece) => piece?.slot === key)) {
      const rang = restantes.findIndex((piece) => piece.id === item.id);
      if (rang >= 0) restantes.splice(rang, 1);
      else sortantes.push(item);
    }
    const paires = Math.max(sortantes.length, restantes.length);
    for (let i = 0; i < paires; i += 1) {
      changements.push({ slot: key, sortante: sortantes[i] ?? null, entrante: restantes[i] ?? null });
    }
  }
  return changements;
}

/** Nombre de bits a un. */
function compterBits(masque) {
  let reste = masque;
  let total = 0;
  while (reste) {
    reste &= reste - 1;
    total += 1;
  }
  return total;
}

/** Vrai quand une arme a deux mains cotoie un bouclier. */
function mainsEnConflit(items) {
  return items.some((item) => item.slot === 'arme' && item.twoHanded)
    && items.some((item) => item.slot === 'bouclier');
}

/**
 * Juge un stuff : tient-il ses conditions, et que vaut-il ?
 *
 * Un stuff tient quand chaque piece s'equipe, que chaque minimum est atteint
 * et qu'aucun maximum absolu n'est depasse. Le plan et les pieces de passage
 * jugent avec cette seule regle.
 *
 * @param {any[]} items
 * @param {object} contexte level, allocation, scrolls, passives, profile,
 *   setById, objective, exos.
 * @returns {{valide: boolean, score: number}}
 */
export function jugerStuff(items, contexte) {
  const { level, allocation, scrolls, passives, profile, setById, objective, exos = null } = contexte;
  const { stats, invalid } = computeBuild({
    items, level, allocation, scrolls, passives, profile, menace: objective?.menace,
    exos, exosLibres: objective?.exosLibres ?? null,
  }, setById);
  const detail = scoreBuild(stats, objective, SANS_DETAILS);
  const valide = !mainsEnConflit(items) && invalid.length === 0 && detail.satisfied
    && maxViolations(objective.conditions, stats, detail.damage).length === 0;
  return { valide, score: detail.score };
}

/**
 * Le stuff porte apres les premieres etapes du plan.
 *
 * @param {any[]} actuel
 * @param {{entrantes: any[], sortantes: any[]}[]} etapes
 * @param {number} nombre Etapes faites.
 * @returns {any[]}
 */
export function stuffApres(actuel, etapes, nombre) {
  return etapes.slice(0, nombre).reduce((porte, etape) => {
    const sortantes = new Set(etape.sortantes);
    return [...porte.filter((item) => !sortantes.has(item)), ...etape.entrantes];
  }, actuel);
}

/**
 * Juge les stuffs intermediaires, chacun une seule fois.
 *
 * @returns {(masque: number) => {valide: boolean, score: number}}
 */
function creerJuge(actuel, changements, contexte) {
  const taille = 1 << changements.length;
  const etats = new Uint8Array(taille);
  const scores = new Float64Array(taille);

  const stuffDe = (masque) => {
    const sortantes = new Set();
    const entrantes = [];
    changements.forEach((changement, bit) => {
      if (!(masque & (1 << bit))) return;
      if (changement.sortante) sortantes.add(changement.sortante);
      if (changement.entrante) entrantes.push(changement.entrante);
    });
    return [...actuel.filter((item) => !sortantes.has(item)), ...entrantes];
  };

  return function juger(masque) {
    if (etats[masque] === INCONNU) {
      const { valide, score } = jugerStuff(stuffDe(masque), contexte);
      etats[masque] = valide ? VALIDE : INVALIDE;
      scores[masque] = score;
    }
    return { valide: etats[masque] === VALIDE, score: scores[masque] };
  };
}

/** Rapport gain par kama ; une etape gratuite passe devant tout achat. */
function rapport(gain, cout) {
  if (cout === 0) return gain >= 0 ? Infinity : -Infinity;
  return gain / cout;
}

/**
 * Les plus petits groupes de changements qui menent a un stuff valide.
 *
 * Un groupe contient au moins une piece entrante : enlever une piece sans rien
 * poser a sa place n'est pas une etape, seulement une consequence d'une etape.
 */
function groupesMinimaux(courant, restants, avecEntrante, juger) {
  const valides = [];
  for (let groupe = restants; groupe > 0; groupe = (groupe - 1) & restants) {
    if ((groupe & avecEntrante) === 0) continue;
    if (juger(courant | groupe).valide) valides.push(groupe);
  }
  valides.sort((a, b) => compterBits(a) - compterBits(b));
  const minimaux = [];
  for (const groupe of valides) {
    if (!minimaux.some((petit) => (petit & groupe) === petit)) minimaux.push(groupe);
  }
  return minimaux;
}

/** Ce que les kamas du joueur permettent maintenant. */
function planDuJour(etapes, kamas, coutDe) {
  let reste = Math.max(0, Number(kamas) || 0);
  let etapesPayables = 0;
  while (etapesPayables < etapes.length && etapes[etapesPayables].cout <= reste) {
    reste -= etapes[etapesPayables].cout;
    etapesPayables += 1;
  }

  const suivante = etapes[etapesPayables];
  if (!suivante) return { etapesPayables, reste, banque: [], manque: 0 };

  const aAcheter = suivante.entrantes
    .filter((item) => coutDe(item) > 0)
    .sort((a, b) => coutDe(a) - coutDe(b));
  const banque = [];
  let disponible = reste;
  for (const item of aAcheter) {
    if (coutDe(item) > disponible) break;
    banque.push(item);
    disponible -= coutDe(item);
  }
  return { etapesPayables, reste, banque, manque: suivante.cout - reste };
}

/**
 * Plan de transition du stuff actuel vers le stuff cible.
 *
 * @param {object} demande
 * @param {any[]} demande.actuel Pieces portees en jeu.
 * @param {any[]} demande.cible Pieces du stuff vise.
 * @param {Map<number, number>} demande.prix Prix d'achat en kamas, par piece.
 * @param {number} [demande.kamas] Kamas disponibles.
 * @param {Set<number>} [demande.possedees] Pieces deja en banque.
 * @param {object} demande.contexte level, allocation, scrolls, passives,
 *   profile, setById, objective, exos : comme pour le moteur.
 * @returns {{depart: {valide: boolean, score: number}, prixManquants: any[],
 *   etapes: any[]|null, coutTotal: number|null, maintenant: any|null}}
 */
export function planifierTransition({ actuel, cible, prix, kamas = 0, possedees = new Set(), contexte }) {
  const changements = apparier(actuel, cible);
  const juger = creerJuge(actuel, changements, contexte);
  const depart = juger(0);

  const coutDe = (item) => (possedees.has(item.id) ? 0 : prix.get(item.id));
  const prixManquants = changements
    .map((changement) => changement.entrante)
    .filter((item) => item && coutDe(item) === undefined);
  if (prixManquants.length > 0) {
    return { depart, prixManquants, etapes: null, coutTotal: null, maintenant: null };
  }

  const tout = (1 << changements.length) - 1;
  const avecEntrante = changements.reduce((masque, changement, bit) => (
    changement.entrante ? masque | (1 << bit) : masque), 0);
  const coutGroupe = (groupe) => changements.reduce((somme, changement, bit) => (
    groupe & (1 << bit) && changement.entrante ? somme + coutDe(changement.entrante) : somme), 0);

  const etapes = [];
  let courant = 0;
  let scoreCourant = depart.score;
  while (courant !== tout) {
    const restants = tout & ~courant;
    const candidats = (restants & avecEntrante) === 0
      ? []
      : groupesMinimaux(courant, restants, avecEntrante, juger);
    // Sans groupe valide, ou quand il ne reste que des pieces a enlever, le
    // plan finit d'un coup sur le stuff cible.
    const groupe = candidats.length === 0 ? restants : meilleurGroupe(candidats, courant, scoreCourant, juger, coutGroupe);

    const suivant = courant | groupe;
    const { valide, score } = juger(suivant);
    const choisis = changements.filter((_, bit) => groupe & (1 << bit));
    etapes.push({
      entrantes: choisis.map((c) => c.entrante).filter(Boolean),
      sortantes: choisis.map((c) => c.sortante).filter(Boolean),
      cout: coutGroupe(groupe),
      score,
      gain: score - scoreCourant,
      valide,
    });
    courant = suivant;
    scoreCourant = score;
  }

  const coutTotal = etapes.reduce((somme, etape) => somme + etape.cout, 0);
  return { depart, prixManquants, etapes, coutTotal, maintenant: planDuJour(etapes, kamas, coutDe) };
}

/** Le groupe au meilleur gain par kama ; a egalite, le plus gros gain, puis le moins cher. */
function meilleurGroupe(candidats, courant, scoreCourant, juger, coutGroupe) {
  const notes = candidats.map((groupe) => {
    const gain = juger(courant | groupe).score - scoreCourant;
    const cout = coutGroupe(groupe);
    return { groupe, gain, cout, rapport: rapport(gain, cout) };
  });
  notes.sort((a, b) => b.rapport - a.rapport || b.gain - a.gain || a.cout - b.cout);
  return notes[0].groupe;
}
