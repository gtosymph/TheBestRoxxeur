/**
 * La courbe « sagesse contre degats » du mode Monter.
 *
 * Le mode mixte a un curseur parce qu'il a un reglage : la part des degats.
 * Le mode Monter n'en a pas, et ne doit pas en avoir — le score est un
 * PRODUIT, et un produit ne se regle pas. Tuer deux fois plus vite vaut
 * exactement autant que doubler le multiplicateur d'XP.
 *
 * Reste la question que le joueur se pose quand meme : « si je monte a 400 de
 * sagesse, je perds combien de degats ? ». La courbe y repond sans relancer
 * la recherche, et marque au passage le point qui gagne le produit. Cliquer
 * un point porte son stuff : chaque point EST un stuff entier.
 */
import { multiplicateurXp, vitesseXp } from '../../src/solver/score.mjs';

/** Les deux mesures d'un palier, lues sans surprise. */
const mesures = (palier) => ({
  degats: Number(palier?.damage) || 0,
  sagesse: Number(palier?.sagesse) || 0,
});

/**
 * Rang du palier dont la vitesse d'XP est la plus haute.
 *
 * A egalite, le premier rencontre garde la main : deux stuffs qui font monter
 * aussi vite sont interchangeables, et changer d'avis a chaque redessin ferait
 * sauter le marqueur sans raison.
 *
 * Le bonus hors sagesse compte : il se range dans la meme parenthese que la
 * sagesse, et peut faire gagner un point plus riche en degats.
 *
 * @param {{palier: {damage: number, sagesse: number}}[]} lignes
 * @param {number} [bonus] Bonus d'XP hors sagesse, en pourcents.
 * @returns {number|null}
 */
export function palierXpRetenu(lignes, bonus = 0) {
  let rang = null;
  let meilleure = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < (lignes?.length ?? 0); i += 1) {
    const { degats, sagesse } = mesures(lignes[i]?.palier);
    const vitesse = vitesseXp(degats, sagesse, bonus);
    if (vitesse > meilleure) { meilleure = vitesse; rang = i; }
  }

  return rang;
}

/**
 * Ce qu'un point de la courbe annonce.
 *
 * La vitesse d'XP sert a classer, le multiplicateur sert a LIRE : le premier
 * est un produit sans unite, le second se compare a ce que le joueur connait
 * de son personnage. La bande montre donc le multiplicateur.
 *
 * @param {{palier: {damage: number, sagesse: number}}[]} lignes
 * @param {number|null} rang
 * @param {number} [bonus] Bonus d'XP hors sagesse, en pourcents.
 * @returns {{degats: number, sagesse: number, multiplicateur: number,
 *   vitesse: number}|null}
 */
export function consequenceXp(lignes, rang, bonus = 0) {
  const palier = lignes?.[rang ?? -1]?.palier;
  if (!palier) return null;
  const { degats, sagesse } = mesures(palier);
  return {
    degats,
    sagesse,
    multiplicateur: multiplicateurXp(sagesse, bonus),
    vitesse: vitesseXp(degats, sagesse, bonus),
  };
}

/**
 * Signature d'une courbe : deux courbes sont la meme si elles portent les
 * memes paliers, dans le meme ordre. Elle decide si le bloc se reconstruit.
 *
 * @param {{palier: {damage: number, sagesse: number}}[]} lignes
 * @returns {string}
 */
export const signatureXp = (lignes) => (lignes ?? [])
  .map((l) => `${l?.palier?.damage}/${l?.palier?.sagesse}`).join('|');

/**
 * Rang d'un palier retrouve par ses deux mesures.
 *
 * Le rang ne survit pas a un clic : poser un stuff recalcule la courbe et
 * fait glisser les rangs. Ce qui traverse un recalcul, c'est le palier.
 *
 * @param {{palier: {damage: number, sagesse: number}}[]} lignes
 * @param {{damage: number, sagesse: number}|null} palier
 * @returns {number|null}
 */
export function rangDuPalierXp(lignes, palier) {
  if (!palier || !Array.isArray(lignes)) return null;
  const rang = lignes.findIndex((l) => l?.palier?.damage === palier.damage
    && l?.palier?.sagesse === palier.sagesse);
  return rang === -1 ? null : rang;
}
