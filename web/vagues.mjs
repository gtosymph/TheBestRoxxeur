/**
 * Les morceaux d'une vague de recherche qui ne touchent pas au fil.
 *
 * Le fil de calcul (solver-worker.mjs) enchaine les vagues et parle au fil
 * principal. Ce qui se calcule sans lui vit ici, et se teste sans navigateur.
 */

/**
 * Generations par vague : le compromis entre reactivite et debit.
 *
 * Une vague ne rend la main qu'une fois finie : c'est elle qui fixe le delai
 * de reponse a la Pause et le rythme des echanges entre fils. Mesure du
 * 2026-08-31 dans le navigateur : 20 generations coutent environ une seconde
 * sur un objectif avec arme, plusieurs fois plus quand tous les fils se
 * partagent les coeurs.
 */
export const GENERATIONS_PAR_VAGUE = 20;

/**
 * Les reglages du solveur pour une vague : ceux du joueur, bornes a une vague.
 *
 * @param {object} [options] Les options de la demande.
 * @param {number} graine Graine de la vague, avant reduction a 32 bits.
 */
export function optionsDeVague(options, graine) {
  return {
    ...options,
    maxGenerations: GENERATIONS_PAR_VAGUE,
    stagnationLimit: Number.POSITIVE_INFINITY,
    optimiserPoints: true,
    seed: graine >>> 0,
  };
}

/**
 * Garde, pour chaque cle, le palier le plus haut vu jusqu'ici.
 *
 * Les paliers se cumulent sur toute la recherche : chaque vague en rend sa
 * lecture, et la carte garde le meilleur de chaque palier. Elle est
 * l'accumulateur du fil, et change donc en place.
 *
 * @param {Map<number, any>} gardes
 * @param {any[]|undefined} paliers
 * @param {{cle: string, valeur: string}} lecture Le champ qui range, et celui qui departage.
 */
export function fusionnerPaliers(gardes, paliers, { cle, valeur }) {
  for (const palier of paliers ?? []) {
    const connu = gardes.get(palier[cle]);
    if (!connu || palier[valeur] > connu[valeur]) gardes.set(palier[cle], palier);
  }
}

/** Les paliers gardes, dans l'ordre de leur cle. */
export function parCle(gardes, cle) {
  return [...gardes.values()].sort((a, b) => a[cle] - b[cle]);
}
