/**
 * Les nombres tels que l'ecran les ecrit : a la francaise, sans decimale
 * pour une mesure, a deux decimales pour un multiplicateur.
 */

/** Une mesure arrondie, avec l'espace des milliers. */
export const nombre = (n) => Math.round(n).toLocaleString('fr-FR');

/** Un multiplicateur, a deux decimales et avec la virgule francaise. */
export const facteur = (n) => Number(n).toLocaleString('fr-FR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
