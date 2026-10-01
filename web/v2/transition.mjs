/**
 * Ce que la feuille de transition lit dans l'etat.
 *
 * Le depart est le stuff fige comme celui porte en jeu (« Mon stuff actuel ») ;
 * l'arrivee est le stuff pose a l'ecran, celui que le joueur a choisi parmi
 * les stuffs trouves. Ce module ne touche pas au document : il prepare la
 * demande du plan, et dit quand la feuille a un sens.
 */
import { cibleAffichee, passifsActifs, profilDe } from '../objectif.mjs';

/** Identifiants tries, pour comparer deux stuffs sans regarder les cases. */
const signature = (ids) => [...ids].map(Number).sort((a, b) => a - b).join(',');

/**
 * Vrai quand un stuff actuel est fige et que le stuff pose en differe.
 *
 * @param {any} etat
 * @returns {boolean}
 */
export function transitionPossible(etat) {
  const reference = etat?.reference?.itemIds ?? [];
  const porte = [...(etat?.equipped?.values() ?? [])].map((item) => item.id);
  return reference.length > 0 && porte.length > 0 && signature(reference) !== signature(porte);
}

/**
 * La demande du plan, sans les prix ni les kamas.
 *
 * Une piece du stuff actuel absente du catalogue (retiree du jeu) ne se
 * compte pas : le plan ne peut rien en dire.
 *
 * @param {any} etat
 * @param {{itemById: Map<number, any>, setById: Map<number, any>}} catalogue
 */
export function demandeDeTransition(etat, catalogue) {
  return {
    actuel: (etat.reference?.itemIds ?? []).map((id) => catalogue.itemById.get(id)).filter(Boolean),
    cible: [...etat.equipped.values()],
    possedees: etat.possedees ?? new Set(),
    contexte: {
      level: etat.niveau,
      allocation: etat.allocation,
      scrolls: etat.scrolls,
      passives: passifsActifs(etat),
      profile: profilDe(etat),
      setById: catalogue.setById,
      objective: cibleAffichee(etat),
    },
  };
}
