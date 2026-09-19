/**
 * Ce que le bloc « Cible » dit sans qu'on l'ouvre.
 *
 * Le nombre de degats ne veut rien dire sans savoir contre quoi il est
 * compte. La phrase sous le nombre le dit en une ligne : le vide, cinq
 * pourcentages poses a la main, un monstre et son grade, ou la moyenne de
 * plusieurs. Ce module ne touche pas au DOM : la vue le lit, un test aussi.
 */
import { ELEMENTS } from '../../src/data/stats.mjs';
import { estVide, resistancesCible } from '../../src/engine/cible.mjs';

/** Etiquette courte de chaque element, dans l'ordre du moteur. */
export const ETIQUETTES_ELEMENTS = Object.freeze([
  ['neutre', 'Neutre'],
  ['terre', 'Terre'],
  ['feu', 'Feu'],
  ['eau', 'Eau'],
  ['air', 'Air'],
]);

/** Les cinq pourcentages en une suite : « 14/17/16/29/25 % ». */
export function suiteResistances(res) {
  const signe = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));
  return `${ELEMENTS.map((element) => signe(Number(res?.[element]) || 0)).join('/')} %`;
}

/**
 * La phrase du bloc.
 * @param {{manuel: Record<string, number>, monstres: any[]}} cible
 * @returns {string}
 */
export function resumeCible(cible) {
  if (!cible || estVide(cible)) return 'Dans le vide, sans résistance.';
  const suite = suiteResistances(resistancesCible(cible));
  const monstres = cible.monstres ?? [];
  if (monstres.length === 0) return `Résistances posées à la main · ${suite}`;
  if (monstres.length === 1) {
    const [m] = monstres;
    return `${m.nom || 'Monstre'} (grade ${m.grade}) · ${suite}`;
  }
  return `${monstres.length} monstres, en moyenne · ${suite}`;
}
