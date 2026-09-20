/**
 * Ce qu'une rune pese, et ce qu'une piece accepte.
 *
 * En jeu, la forgemagie ne se paie pas en kamas seulement : chaque ligne a un
 * POIDS, et une piece n'accepte pas plus de cent un de poids d'over et d'exo
 * reunis. Deux consequences que tout le reste du module suit :
 *
 *   - un exo PA pese cent. Il ne reste alors plus de place pour rien d'autre,
 *     et deux exos rares ne tiennent jamais ensemble. C'est la regle « un exo
 *     rare par piece » que le moteur appliquait deja, expliquee ;
 *   - un over se borne tout seul. Cent un de poids valent cent un points de
 *     force, mais cinq cent cinq de vitalite, ou cinq points de dommages.
 *
 * Une regle de plus, et le modele est complet : un over ne POUSSE qu'une ligne
 * que la piece porte deja. Ajouter une ligne neuve est un exotique, et le
 * moteur ne sait en poser que trois — PA, PM et portee.
 *
 * Sources : les tables de poids de la communaute, concordantes depuis des
 * annees (tofus.fr, dafous.app). Les valeurs ci-dessous sont celles qu'un
 * forgemage lit sur sa table.
 */

/**
 * Poids d'un point de chaque caracteristique.
 *
 * Une statistique absente de cette table ne se forge pas : le moteur n'a pas a
 * deviner ce que vaudrait une rune qui n'existe pas.
 */
export const POIDS_RUNE = Object.freeze({
  vitalite: 0.2,
  sagesse: 3,
  force: 1,
  intelligence: 1,
  chance: 1,
  agilite: 1,
  puissance: 2,

  pa: 100,
  pm: 90,
  po: 51,
  critique: 10,
  initiative: 0.1,
  prospection: 3,
  invocations: 30,

  retraitPa: 7,
  retraitPm: 7,
  soins: 10,

  dommages: 20,
  dommagesNeutre: 20,
  dommagesTerre: 20,
  dommagesFeu: 20,
  dommagesEau: 20,
  dommagesAir: 20,
  dommagesCritiques: 5,

  resNeutre: 2,
  resTerre: 2,
  resFeu: 2,
  resEau: 2,
  resAir: 2,
  resCritique: 2,

  pctResNeutre: 6,
  pctResTerre: 6,
  pctResFeu: 6,
  pctResEau: 6,
  pctResAir: 6,
});

/**
 * Poids d'over et d'exo qu'une piece accepte, toutes lignes confondues.
 * C'est la limite du jeu, pas un reglage : au-dela, la rune ne passe pas.
 */
export const BUDGET_POIDS = 101;

/**
 * Ce que pesent des points d'une caracteristique.
 *
 * @param {string} stat
 * @param {number} points
 * @returns {number|null} Null quand la caracteristique ne se forge pas.
 */
export function poidsDe(stat, points) {
  const unitaire = POIDS_RUNE[stat];
  if (unitaire === undefined) return null;
  return unitaire * points;
}

/**
 * Combien de points un budget de poids paie, sans jamais le depasser.
 *
 * @param {string} stat
 * @param {number} budget
 * @returns {number} Zero quand la caracteristique ne se forge pas.
 */
export function pointsTenables(stat, budget) {
  const unitaire = POIDS_RUNE[stat];
  if (!unitaire || !(budget > 0)) return 0;
  return Math.floor(budget / unitaire);
}

/**
 * La ligne qu'un forgemage pousserait sur cette piece, et de combien.
 *
 * Le choix se fait au rapport : ce que le point rapporte a l'objectif, divise
 * par ce qu'il pese. Une valeur linéaire en points rend le meilleur rapport
 * gagnant sur tout le budget — il n'y a donc rien a partager entre deux
 * lignes, la meilleure prend tout.
 *
 * @param {{stats?: Record<string, number>}} piece
 * @param {Record<string, number>} valeurs Ce que vaut UN point, par caracteristique.
 * @param {number} budget Poids disponible sur la piece.
 * @returns {{stat: string, valeur: number, poids: number}|null} Null quand rien
 *   ne merite d'etre pousse.
 */
export function choisirOver(piece, valeurs, budget) {
  if (!(budget > 0)) return null;

  let meilleur = null;
  for (const [stat, porte] of Object.entries(piece?.stats ?? {})) {
    // Un over POUSSE une ligne existante : la piece doit deja la porter, et
    // la porter en positif. Pousser une malediction n'aurait aucun sens.
    if (!(porte > 0)) continue;

    const valeur = Number(valeurs?.[stat]) || 0;
    if (valeur <= 0) continue;

    const points = pointsTenables(stat, budget);
    if (points <= 0) continue;

    const rapport = valeur / POIDS_RUNE[stat];
    if (!meilleur || rapport > meilleur.rapport) {
      meilleur = { stat, valeur: points, poids: poidsDe(stat, points), rapport };
    }
  }

  if (!meilleur) return null;
  return { stat: meilleur.stat, valeur: meilleur.valeur, poids: meilleur.poids };
}
