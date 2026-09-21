/**
 * Ce qu'un minimum vaut, et ce qui reste a poser.
 *
 * La feuille des minimums dessine ; ce module decide. Les deux regles qu'il
 * porte sont les seules du volet qui puissent se tromper sans qu'on le voie a
 * l'ecran, et ce sont donc les seules qui meritent un test.
 */

/**
 * Ce qu'un minimum vaut a sa creation.
 *
 * Le poids 1 en fait une preference, pas un couperet : le solveur la tiendra
 * s'il peut. C'est le reglage le moins surprenant pour qui vient d'ajouter
 * une ligne sans encore savoir ce que le poids veut dire.
 *
 * @param {string} stat
 */
export const MINIMUM_NEUF = (stat) => ({
  stat, target: 0, weight: 1, max: null, absolute: false,
});

/**
 * Les mesures sur lesquelles aucun minimum ne porte encore.
 *
 * La liste d'ajout ne propose que celles-la : offrir un choix qui sera refuse
 * au clic suivant n'aide personne. L'ordre du catalogue est conserve, et la
 * mesure des degats ferme la marche — elle ne vient pas des caracteristiques,
 * mais elle se pose comme les autres.
 *
 * @param {{stat: string}[]} conditions Minimums deja poses.
 * @param {{key: string, fr: string}[]} statistiques Catalogue des mesures.
 * @param {{cle: string, libelle: string}} degats La mesure des degats.
 * @returns {[string, string][]} Paires cle / libelle, prêtes pour une liste.
 */
export function mesuresLibres(conditions, statistiques, degats) {
  const posees = new Set((conditions ?? []).map((c) => c.stat));
  return [
    ...statistiques.filter((s) => !posees.has(s.key)).map((s) => [s.key, s.fr]),
    ...(posees.has(degats.cle) ? [] : [[degats.cle, degats.libelle]]),
  ];
}

/**
 * La meme liste de minimums, avec une nouvelle valeur a tenir sur l'un d'eux.
 *
 * Le volet de gauche montre les minimums en permanence, et c'est la qu'on
 * veut passer de cinq PM a six. Les regler demandait d'ouvrir une feuille,
 * de trouver la ligne et de la refermer, pour un seul chiffre.
 *
 * La valeur se ramene a un entier positif : un objectif negatif est tenu par
 * n'importe quel stuff et ne veut rien dire.
 *
 * @param {{stat: string, target: number}[]} conditions
 * @param {string} stat
 * @param {unknown} valeur
 * @returns {{stat: string, target: number}[]} Nouvelle liste ; l'ancienne ne bouge pas.
 */
export function avecCible(conditions, stat, valeur) {
  const brut = Number(valeur);
  const cible = Number.isFinite(brut) ? Math.max(0, Math.round(brut)) : 0;
  return (conditions ?? []).map((c) => (c.stat === stat ? { ...c, target: cible } : c));
}
