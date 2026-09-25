/**
 * Les stuffs coches pour la comparaison, d'ou qu'ils viennent.
 *
 * La cle porte sur le STUFF, jamais sur l'objet. Les candidats se recreent a
 * chaque vague du solveur, les essais se relisent du rangement a chaque
 * dessin : l'objet change, le stuff non. Une table cle par l'objet gardait
 * des coches fantomes, que plus aucune case ne montrait et que la
 * comparaison comptait quand meme.
 *
 * Chaque fonction rend une NOUVELLE table ; celle recue ne bouge pas.
 */

/** Identifiants des pieces d'un stuff, dans un ordre stable. */
const idsDe = (objet) => (objet.itemIds ?? (objet.pieces ?? []).map((p) => p.id))
  .map(Number)
  .sort((a, b) => a - b)
  .join(',');

/**
 * Cle d'un stuff dans une liste.
 *
 * Le meme stuff peut paraitre dans deux listes — un palier d'achat et un
 * stuff trouve — et le joueur peut vouloir les deux colonnes : la famille
 * entre dans la cle.
 *
 * @param {any} objet Candidat, palier ou essai.
 * @param {string} famille 'trouve', 'palier', 'survie' ou 'essai'.
 * @returns {string}
 */
export function cleDeChoix(objet, famille) {
  if (objet.id !== undefined && objet.id !== null && famille === 'essai') return `essai:${objet.id}`;
  return `${famille}:${idsDe(objet)}`;
}

/**
 * Coche ou decoche un stuff.
 *
 * @param {Map<string, {objet: any, nom: string, famille: string}>} choisis
 * @param {any} objet
 * @param {string} famille
 * @param {string} nom Comment la colonne se nomme.
 * @returns {Map<string, {objet: any, nom: string, famille: string}>}
 */
export function basculerChoix(choisis, objet, famille, nom) {
  const cle = cleDeChoix(objet, famille);
  const suite = new Map(choisis);
  if (suite.has(cle)) suite.delete(cle);
  else suite.set(cle, { objet, nom, famille });
  return suite;
}

/**
 * Garde les coches dont le stuff est encore a l'ecran, avec l'objet du jour.
 *
 * L'objet se remplace parce qu'un candidat recree porte des degats a jour ;
 * comparer l'ancien montrerait des chiffres d'une vague passee.
 *
 * @param {Map<string, {objet: any, nom: string, famille: string}>} choisis
 * @param {{objet: any, famille: string}[]} vivants Ce que les listes montrent.
 * @returns {Map<string, any>} La meme table si rien ne change.
 */
export function rafraichirChoix(choisis, vivants) {
  const parCle = new Map(vivants.map(({ objet, famille }) => [cleDeChoix(objet, famille), objet]));
  let change = false;
  const suite = new Map();
  for (const [cle, entree] of choisis) {
    const objet = parCle.get(cle);
    if (objet === undefined) { change = true; continue; }
    if (objet !== entree.objet) change = true;
    suite.set(cle, objet === entree.objet ? entree : { ...entree, objet });
  }
  return change ? suite : choisis;
}

/** Nom de la colonne du stuff fige comme celui porte en jeu. */
export const NOM_STUFF_ACTUEL = 'Mon stuff actuel';

/**
 * Les colonnes de la comparaison, dans l'ordre ou elles se lisent.
 *
 * Le stuff porte ouvre la marche. Le stuff actuel suit, parce que c'est face
 * a lui que le joueur decide d'un achat. Il se tait quand il porte les memes
 * pieces que le stuff porte : la colonne repeterait la premiere. Les coches
 * viennent ensuite, dans l'ordre ou le joueur les a posees.
 *
 * @param {Map<string, {objet: any, nom: string}>} choisis
 * @param {object} contexte
 * @param {{itemIds: number[]}|null} contexte.reference Stuff actuel, ou null.
 * @param {number[]} contexte.porteIds Pieces du stuff porte.
 * @returns {{nom: string, objet: any|null}[]} `objet` vaut null pour le porte.
 */
export function colonnesAComparer(choisis, { reference, porteIds }) {
  const actuel = reference && idsDe(reference) !== idsDe({ itemIds: porteIds })
    ? [{ nom: NOM_STUFF_ACTUEL, objet: { itemIds: reference.itemIds } }]
    : [];
  return [
    { nom: 'Porté', objet: null },
    ...actuel,
    ...[...choisis.values()].map(({ objet, nom }) => ({ nom, objet })),
  ];
}
