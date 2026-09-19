/**
 * Gestes de forgemagie sur une piece, et ce qu'ils donnent a lire.
 *
 * L'etat garde les exos PAR PIECE : `etat.exos[id] = { pa: 1, over: {...} }`.
 * Chaque fonction lit cette table et en rend une NOUVELLE ; l'entree ne bouge
 * pas, « Annuler » revient dessus d'un geste entier.
 *
 * Une piece sans plus rien dessus quitte la table : une entree vide se
 * partagerait et se rangerait pour rien.
 */
import { EXOS_RARES, statsExo } from '../src/engine/exos.mjs';
import { LIBELLE_SLOT_EXO } from './layout.mjs';

/** Comment l'ecran nomme chaque exo rare. */
export const LIBELLE_EXO = Object.freeze({ pa: 'PA', pm: 'PM', po: 'portée' });

/** Vrai quand la piece n'a plus aucune forgemagie. */
const vide = (exo) => Object.keys(statsExo(exo)).length === 0;

/** La table, avec cette piece remplacee ou retiree si elle est vide. */
function avec(exos, id, exo) {
  const { [id]: ancien, ...reste } = exos ?? {};
  void ancien;
  return vide(exo) ? reste : { ...reste, [id]: exo };
}

/**
 * Pose ou enleve un exo rare sur une piece.
 *
 * Le jeu n'accepte qu'un exo rare par piece : poser le PM enleve le PA. Il
 * refuse aussi d'ajouter une ligne que la piece porte deja — un anneau a PA
 * ne prend pas d'exo PA.
 *
 * @param {Record<string, any>} exos Table de l'etat.
 * @param {number} id Piece visee.
 * @param {'pa'|'pm'|'po'} cle
 * @param {any} [item] La piece, pour verifier sa ligne native.
 * @returns {Record<string, any>}
 */
export function basculerExoRare(exos, id, cle, item = null) {
  if (!EXOS_RARES.includes(cle)) throw new TypeError(`Exo inconnu : ${cle}`);
  if (item?.stats?.[cle]) {
    throw new Error(`Cette pièce porte déjà ${LIBELLE_EXO[cle]} : l'exo n'y a pas sa place.`);
  }
  const actuel = exos?.[id] ?? {};
  const suivant = { ...(actuel.over ? { over: actuel.over } : {}) };
  if (!actuel[cle]) suivant[cle] = 1;
  return avec(exos, id, suivant);
}

/**
 * Met la valeur d'over d'une ligne : ce que le forgemage a obtenu AU-DELA du
 * jet parfait. Zero, vide ou invalide efface la ligne.
 *
 * @param {Record<string, any>} exos
 * @param {number} id
 * @param {string} stat
 * @param {number|string} valeur
 */
export function mettreOver(exos, id, stat, valeur) {
  const nombre = Math.trunc(Number(valeur));
  const actuel = exos?.[id] ?? {};
  const { [stat]: ancienne, ...autres } = actuel.over ?? {};
  void ancienne;
  const over = Number.isFinite(nombre) && nombre !== 0 ? { ...autres, [stat]: nombre } : autres;
  const { over: ancienOver, ...rares } = actuel;
  void ancienOver;
  return avec(exos, id, Object.keys(over).length > 0 ? { ...rares, over } : rares);
}

/**
 * Les lignes d'une piece, forgemagie comprise.
 *
 * Les lignes du catalogue gardent leur ordre ; les exos qui n'ajoutent pas a
 * une ligne existante viennent apres. Chaque ligne dit sa part d'exo, pour
 * que la fiche la marque.
 *
 * @param {any} item
 * @param {any} exo
 * @returns {{cle: string, valeur: number, base: number, exo: number}[]}
 */
export function lignesAvecExos(item, exo) {
  const ajouts = statsExo(exo);
  const base = Object.entries(item?.stats ?? {}).filter(([, v]) => v !== 0);
  const vues = new Set(base.map(([cle]) => cle));

  return [
    ...base.map(([cle, valeur]) => ({
      cle, valeur: valeur + (ajouts[cle] ?? 0), base: valeur, exo: ajouts[cle] ?? 0,
    })),
    ...Object.entries(ajouts)
      .filter(([cle]) => !vues.has(cle))
      .map(([cle, valeur]) => ({ cle, valeur, base: 0, exo: valeur })),
  ];
}

/**
 * Adopte les exos rares que le solveur a poses : ils deviennent ceux du
 * joueur, pour que le stuff porte vaille ce que la recherche annoncait.
 *
 * @param {Record<string, any>} exos
 * @param {{id: number, cle: string}[]} places
 */
export function poserExosLibres(exos, places) {
  return (places ?? []).reduce((table, { id, cle }) => {
    const actuel = table[id] ?? {};
    return { ...table, [id]: { ...actuel, [cle]: 1 } };
  }, exos ?? {});
}

/**
 * Les exos rares portes par un stuff, dans l'ordre des pieces.
 *
 * @param {Record<string, any>} exos
 * @param {any[]} items
 * @returns {{id: number, cle: string}[]}
 */
export function exosPortes(exos, items) {
  return (items ?? []).flatMap((item) => {
    const exo = exos?.[item?.id];
    return EXOS_RARES.filter((cle) => exo?.[cle]).map((cle) => ({ id: item.id, cle }));
  });
}

/**
 * « avec un exo PA sur la ceinture et un exo portée sur les bottes ».
 *
 * @param {{id: number, cle: string}[]} places
 * @param {Map<number, any>} itemById
 * @returns {string} Vide sans exo.
 */
export function decrireExos(places, itemById) {
  const parts = (places ?? []).map(({ id, cle }) => {
    const piece = itemById.get(id);
    const ou = LIBELLE_SLOT_EXO[piece?.slot] ?? `« ${piece?.fr ?? id} »`;
    return `un exo ${LIBELLE_EXO[cle] ?? cle} sur ${ou}`;
  });
  return parts.length === 0 ? '' : `avec ${parts.join(' et ')}`;
}
