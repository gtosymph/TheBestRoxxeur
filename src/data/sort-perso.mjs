/**
 * Les sorts que le joueur ecrit lui-meme.
 *
 * Le catalogue ne couvre pas tout : un sort d'evenement, un effet d'allie, un
 * enchainement que le jeu ne decrit pas. Le joueur ecrit alors son sort, avec
 * autant de lignes de degats qu'il veut, chacune dans son element et, s'il le
 * faut, a un tour plus tard.
 *
 * Un sort personnalise porte le format du moteur, comme un sort du catalogue.
 * Son identifiant est un texte (« perso-3 ») : il ne se confond jamais avec un
 * sort du jeu, et la mise a jour du catalogue ne le touche pas.
 */
import { ELEMENTS, normaliserLigne } from './spell-lines.mjs';

/** Debut de l'identifiant de tout sort personnalise. */
export const PREFIXE_PERSO = 'perso-';

/** Lignes de degats permises sur un sort. */
export const MAX_LIGNES = 20;

/** Bornes des champs du sort, telles que le jeu les permet. */
const BORNES = Object.freeze({
  apCost: { min: 1, max: 12 },
  castsPerTurn: { min: 1, max: 10 },
  baseCrit: { min: 0, max: 100 },
  differe: { min: 0, max: 5 },
});

/** Longueur maximale du nom. */
const NOM_MAX = 40;

/**
 * Vrai quand le sort a ete ecrit par le joueur.
 * @param {any} sort
 * @returns {boolean}
 */
export function estSortPerso(sort) {
  return typeof sort?.id === 'string' && sort.id.startsWith(PREFIXE_PERSO);
}

/**
 * Un premier sort a completer, avec un identifiant libre.
 *
 * @param {any[]} sorts Sorts deja retenus.
 * @returns {object}
 */
export function nouveauSortPerso(sorts) {
  const pris = (sorts ?? [])
    .filter(estSortPerso)
    .map((sort) => Number(sort.id.slice(PREFIXE_PERSO.length)))
    .filter(Number.isFinite);
  const suivant = pris.length > 0 ? Math.max(...pris) + 1 : 1;

  return avecChampsDuMoteur({
    id: `${PREFIXE_PERSO}${suivant}`,
    name: 'Mon sort',
    apCost: 3,
    castsPerTurn: 1,
    baseCrit: 0,
    lines: [{ element: 'feu', min: 10, max: 12, critMin: 12, critMax: 15 }],
  });
}

/**
 * Verifie un sort ecrit par le joueur, et le range au format du moteur.
 *
 * Les erreurs sont des phrases pour le joueur : chacune nomme le champ, ou la
 * ligne, a corriger.
 *
 * @param {any} brouillon
 * @returns {{sort: object|null, erreurs: string[]}}
 */
export function verifierSortPerso(brouillon) {
  const erreurs = [];
  const nom = String(brouillon?.name ?? '').trim();
  if (nom.length === 0) erreurs.push('Donnez un nom au sort.');
  if (nom.length > NOM_MAX) erreurs.push(`Le nom tient en ${NOM_MAX} caractères au plus.`);

  const apCost = entierDans(brouillon?.apCost, BORNES.apCost);
  if (apCost === null) erreurs.push(`Le coût va de ${BORNES.apCost.min} à ${BORNES.apCost.max} PA.`);
  const castsPerTurn = entierDans(brouillon?.castsPerTurn, BORNES.castsPerTurn);
  if (castsPerTurn === null) {
    erreurs.push(`Les lancers par tour vont de ${BORNES.castsPerTurn.min} à ${BORNES.castsPerTurn.max}.`);
  }
  const baseCrit = entierDans(brouillon?.baseCrit ?? 0, BORNES.baseCrit);
  if (baseCrit === null) erreurs.push('Le bonus de critique va de 0 à 100 %.');

  const brutes = Array.isArray(brouillon?.lines) ? brouillon.lines : [];
  if (brutes.length === 0) erreurs.push('Ajoutez au moins une ligne de dégâts.');
  if (brutes.length > MAX_LIGNES) erreurs.push(`Un sort porte ${MAX_LIGNES} lignes au plus.`);

  const lignes = brutes.map((brute, rang) => {
    const { ligne, erreur } = verifierLigne(brute, rang + 1);
    if (erreur) erreurs.push(erreur);
    return ligne;
  });

  if (erreurs.length > 0) return { sort: null, erreurs };

  return {
    sort: avecChampsDuMoteur({
      ...brouillon, name: nom, apCost, castsPerTurn, baseCrit, lines: lignes,
    }),
    erreurs,
  };
}

/**
 * Pose un sort dans la liste : a sa place s'il y est deja, sinon a la fin.
 *
 * @param {any[]} sorts
 * @param {object} sort
 * @returns {any[]}
 */
export function avecSortPerso(sorts, sort) {
  const liste = sorts ?? [];
  if (!liste.some((s) => s.id === sort.id)) return [...liste, sort];
  return liste.map((s) => (s.id === sort.id ? sort : s));
}

/**
 * La forme courte d'un sort, pour le lien de partage.
 *
 * [nom, PA, lancers, critique, [[element, min, max, critMin, critMax, tour]]]
 * L'element voyage par son rang dans ELEMENTS.
 *
 * @param {object} sort
 * @returns {any[]}
 */
export function compacterSortPerso(sort) {
  return [
    sort.name, sort.apCost, sort.castsPerTurn, sort.baseCrit ?? 0,
    sort.lines.map((l) => [
      ELEMENTS.indexOf(l.element), l.min, l.max, l.critMin, l.critMax, l.differe ?? 0,
    ]),
  ];
}

/**
 * Relit la forme courte d'un sort. Une forme abimee rend null.
 *
 * @param {any} forme
 * @param {number} [rang] Rang du sort dans le lien : il fait son identifiant.
 * @returns {object|null}
 */
export function decompacterSortPerso(forme, rang = 0) {
  if (!Array.isArray(forme) || forme.length < 5 || !Array.isArray(forme[4])) return null;
  const [name, apCost, castsPerTurn, baseCrit, lignes] = forme;

  const lues = lignes.map((l) => (Array.isArray(l) ? {
    element: ELEMENTS[l[0]], min: l[1], max: l[2], critMin: l[3], critMax: l[4], differe: l[5],
  } : null));
  if (lues.some((l) => !l || !l.element)) return null;

  const { sort } = verifierSortPerso({
    id: `${PREFIXE_PERSO}${rang + 1}`, name, apCost, castsPerTurn, baseCrit, lines: lues,
  });
  return sort;
}

/** Verifie une ligne, et nomme son rang dans l'erreur. */
function verifierLigne(brute, numero) {
  const base = normaliserLigne(brute);
  const tours = entierDans(brute?.differe ?? 0, BORNES.differe) ?? 0;
  const { differe, condition, ...sansDelai } = base;
  const ligne = { ...sansDelai, ...(tours > 0 ? { differe: tours } : {}) };

  if (!ELEMENTS.includes(brute?.element)) {
    return { ligne, erreur: `La ligne ${numero} n'a pas d'élément connu.` };
  }
  if (ligne.max === 0 && ligne.critMax === 0) {
    return { ligne, erreur: `La ligne ${numero} ne fait aucun dégât.` };
  }
  if (ligne.max < ligne.min || ligne.critMax < ligne.critMin) {
    return { ligne, erreur: `Sur la ligne ${numero}, le maximum est plus bas que le minimum.` };
  }
  return { ligne, erreur: null };
}

/** Ajoute les champs que le moteur et la migration attendent. */
function avecChampsDuMoteur(sort) {
  return {
    ...sort,
    icon: null,
    exclusiveGroup: null,
    telefragCible: null,
    telefrag: { genere: false, consomme: false, bonusSousTelefrag: false },
    lines: sort.lines.map((ligne) => ({ ...ligne, source: 'sort', range: null })),
  };
}

/** L'entier dans les bornes, ou null si la valeur n'y est pas. */
function entierDans(valeur, { min, max }) {
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre) || nombre < min || nombre > max) return null;
  return nombre;
}
