/**
 * Ce que l'objectif paie, ligne par ligne.
 *
 * La forgemagie automatique doit choisir quelle ligne pousser. Elle ne peut
 * pas le deviner d'une regle : un sort de feu paie l'intelligence, une
 * recherche de survie paie la vitalite, et une condition de PA ne se paie avec
 * aucun over. La seule reponse juste est la mesure — on ajoute ce que le
 * budget permet, et on regarde ce que le score gagne.
 *
 * La mesure porte sur le SCORE, pas sur les seuls degats : c'est le score que
 * le solveur maximise, penalites de condition comprises. Elle se prend une
 * fois par recherche, sur le stuff du moment ; le classement des lignes qui
 * paient ne change pas d'un build a l'autre pour un meme objectif.
 */
import { derive } from '../engine/build.mjs';
import { POIDS_RUNE, pointsTenables } from '../engine/runes.mjs';
import { scoreBuild } from './score.mjs';

/** Le detail ne sert a rien ici : seul le score compte. */
const SANS_DETAILS = Object.freeze({ details: false });

/**
 * Les lignes qu'un over peut pousser.
 *
 * Les trois exos rares en sont exclus : un PA ne se pousse pas, il s'ajoute, et
 * le moteur a deja un chemin pour ca — le budget d'exos libres.
 */
export const STATS_FORGEABLES = Object.freeze(
  Object.keys(POIDS_RUNE).filter((stat) => !['pa', 'pm', 'po'].includes(stat)),
);

/**
 * Ce que vaut UN point de chaque ligne forgeable, pour cet objectif.
 *
 * Le pas de mesure vaut ce que le budget achete vraiment. Mesurer au point
 * pres donnerait zero partout : un point d'intelligence ne change aucun
 * arrondi de degats, cent un points le changent.
 *
 * @param {object} entree
 * @param {Record<string, number>} entree.raw Statistiques brutes du stuff de reference.
 * @param {number} entree.level
 * @param {object} entree.objective Objectif de la recherche.
 * @param {number} entree.budget Poids permis par piece.
 * @param {any} [entree.menace] Modele d'adversaire des points de vie effectifs.
 * @returns {Record<string, number>} Valeur par point. Une ligne qui ne rapporte
 *   rien est absente.
 */
export function valeursForge({ raw, level, objective, budget, menace = undefined }) {
  const valeurs = {};
  if (!(budget > 0)) return valeurs;

  const base = scoreBuild(derive(raw, level, menace), objective, SANS_DETAILS).score;

  for (const stat of STATS_FORGEABLES) {
    const points = pointsTenables(stat, budget);
    if (points <= 0) continue;

    const pousse = derive({ ...raw, [stat]: (raw[stat] ?? 0) + points }, level, menace);
    const gain = scoreBuild(pousse, objective, SANS_DETAILS).score - base;
    if (gain > 0) valeurs[stat] = gain / points;
  }

  return valeurs;
}
