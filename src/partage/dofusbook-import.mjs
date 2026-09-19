/**
 * Lecture d'un lien du Dofus-Stuffer de Dofusbook.
 *
 * Le chemin inverse de `dofusbook.mjs` : le lien porte le stuff entier dans
 * son parametre `stuff`, en MessagePack passe en base64, et se relit sans
 * reseau. C'est le seul import possible depuis Dofusbook : un stuff
 * enregistre chez eux, sous un numero, vit sur leur serveur, qui refuse toute
 * lecture hors navigateur et ne pose pas d'en-tete CORS.
 *
 * Les parchemins ne figurent pas dans le lien tels quels : ils sont fondus
 * dans la table « 0 » des statistiques innees. Ils se retrouvent en comparant
 * cette table a ce qu'un personnage nu du meme niveau aurait.
 */

import { SCROLLABLE, SCROLL_BONUS } from '../engine/characteristics.mjs';
import { versOctets } from './base64.mjs';
import { CARACTERISTIQUES, CASES, statistiquesInnees } from './dofusbook.mjs';
import { lire } from './msgpack.mjs';

/** Les cles que leur page exige, et que nous exigeons donc en retour. */
const CLES = Object.freeze(['0', '1', '2', '5']);

/**
 * Le parametre `stuff` d'un texte colle : une adresse entiere, une adresse
 * sans domaine, ou le code seul.
 *
 * @param {string} texte
 * @returns {string}
 */
function codeDe(texte) {
  const propre = String(texte ?? '').trim();
  if (propre === '') throw new TypeError('Le champ est vide : collez le lien du Dofus-Stuffer.');

  if (/^[A-Za-z0-9+/=_-]+$/.test(propre)) return propre;

  const question = propre.indexOf('?');
  if (question === -1) {
    throw new TypeError('Ce lien ne porte pas de parametre « stuff » : seul le lien du Dofus-Stuffer se lit ici.');
  }
  const code = new URLSearchParams(propre.slice(question + 1)).get('stuff');
  if (!code) {
    throw new TypeError('Ce lien ne porte pas de parametre « stuff » : seul le lien du Dofus-Stuffer se lit ici.');
  }
  return code;
}

/** Les parchemins, retrouves par difference avec le personnage nu. */
function parcheminsDe(innees, niveau) {
  const nu = statistiquesInnees(niveau, {});
  return Object.fromEntries(SCROLLABLE.map((caracteristique) => {
    const cle = CARACTERISTIQUES[caracteristique];
    const valeur = Number(innees?.[cle]) || 0;
    return [caracteristique, valeur - (nu[cle] ?? 0) >= SCROLL_BONUS];
  }));
}

/**
 * Ce qu'un lien du Dofus-Stuffer porte.
 *
 * @param {string} texte Lien, ou parametre seul.
 * @returns {{niveau: number, allocation: Record<string, number>,
 *   scrolls: Record<string, boolean>, pieces: [string, number][]}} `pieces`
 *   suit nos cases (`emplacement:rang`) ; une case vide n'y figure pas.
 * @throws {TypeError} Sur un texte qui n'est pas ce lien-la, avec la raison.
 */
export function lireLienDofusbook(texte) {
  const code = codeDe(texte);

  let charge;
  try {
    charge = lire(versOctets(decodeURIComponent(code)));
  } catch (erreur) {
    throw new TypeError(`Ce lien ne se lit pas : ${erreur.message}`);
  }

  if (!charge || typeof charge !== 'object' || CLES.some((cle) => !(cle in charge))) {
    throw new TypeError('Ce lien n\'a pas la forme d\'un stuff Dofusbook : il lui manque des cles.');
  }

  const niveau = Number(charge['2']);
  if (!Number.isInteger(niveau) || niveau < 1 || niveau > 200) {
    throw new TypeError(`Ce lien n'a pas la forme d'un stuff Dofusbook : niveau ${charge['2']}.`);
  }
  const points = Array.isArray(charge['1']) ? charge['1'] : [];
  const cases = Array.isArray(charge['5']) ? charge['5'] : [];

  return {
    niveau,
    allocation: Object.fromEntries(SCROLLABLE.map((cle, i) => [cle, Math.max(0, Math.trunc(Number(points[i]) || 0))])),
    scrolls: parcheminsDe(charge['0'], niveau),
    pieces: CASES
      .map((cle, i) => [cle, Math.trunc(Number(cases[i]) || 0)])
      .filter(([, id]) => id > 0),
  };
}
