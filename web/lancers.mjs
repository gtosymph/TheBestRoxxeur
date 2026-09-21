/**
 * Combien de fois un sort part dans le tour.
 *
 * Deux nombres se ressemblent ici et ne disent pas la meme chose :
 *
 *   - `castsPerTurn` est la LIMITE du jeu. Elle vient des donnees, elle ne se
 *     discute pas, et le joueur ne peut pas la depasser ;
 *   - `repeats` est ce que le total COMPTE. C'est un choix : personne ne lance
 *     toujours chaque sort le maximum de fois, et un tour reel melange les
 *     sorts au lieu de repeter le meilleur.
 *
 * Sans ce choix, le total comptait un lancer par sort pendant que la fiche
 * annoncait « 2 lancers par tour » : les deux chiffres se contredisaient a
 * l'ecran, et rien ne disait lequel entrait dans le score.
 */

/** Limite du jeu pour ce sort : au moins un lancer. */
export function limiteDe(sort) {
  const brut = Number(sort?.castsPerTurn);
  return Number.isFinite(brut) && brut > 0 ? Math.floor(brut) : 1;
}

/**
 * Lancers reellement comptes, bornes par la limite du jeu.
 * Sans choix, un seul : c'est ce que le moteur comptait deja.
 */
export function lancersDe(sort) {
  const limite = limiteDe(sort);
  const brut = Number(sort?.repeats);
  if (!Number.isFinite(brut) || brut < 1) return 1;
  return Math.min(limite, Math.floor(brut));
}

/**
 * La meme liste de sorts, avec un nouveau nombre de lancers sur un sort.
 * La liste d'origine ne bouge pas.
 *
 * @param {any[]} sorts
 * @param {number} id Identifiant du sort vise.
 * @param {number} lancers Nombre demande, ramene dans les bornes.
 * @returns {any[]}
 */
export function avecLancers(sorts, id, lancers) {
  return (sorts ?? []).map((sort) => (sort.id === id
    ? { ...sort, repeats: lancersDe({ ...sort, repeats: lancers }) }
    : sort));
}
