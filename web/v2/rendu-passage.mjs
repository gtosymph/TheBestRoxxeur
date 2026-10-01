/**
 * Le bloc « Ou progresser tout de suite » de la feuille de transition.
 *
 * Il ne parait que quand l'etape suivante coute plus que les kamas du
 * joueur : il montre les pieces de passage, a cote de l'attente en banque.
 * Une piece de passage se jette a la fin ; le bloc le dit, avec son prix.
 */
import { el } from '../render.mjs';

import { nombre } from './nombres.mjs';

const kamas = (n) => `${nombre(n)} kamas`;

/**
 * @param {{parCase: any[], aucune: boolean}} passage Rendu par piecesDePassage.
 * @param {object} liens
 * @param {number} liens.numero Numero de l'etape trop chere.
 * @param {(libelle: string, valeur: number|null, poser: (lu: number|null) => void) => HTMLElement} liens.champKamas
 * @param {(item: any) => number|null} liens.prixDe
 * @param {(item: any, lu: number|null) => void} liens.poserPrix
 * @returns {HTMLElement}
 */
export function blocPassage(passage, { numero, champKamas, prixDe, poserPrix }) {
  const tete = el('strong', { text: 'Ou progresser tout de suite' });
  if (passage.aucune) {
    return el('div', { class: 'transition-passage' }, tete,
      el('p', { class: 'aide', text: 'Aucune pièce de passage ne garde vos conditions.' }));
  }
  return el('div', { class: 'transition-passage' }, tete,
    el('p', { class: 'aide', text: `Une pièce de passage se porte jusqu'à l'étape ${numero}, `
      + 'puis se jette : son prix est perdu. Mettez le prix de celles qui vous intéressent.' }),
    ...passage.parCase.flatMap(({ candidates }) => candidates.map((candidate) =>
      ligneCandidate(candidate, { champKamas, prixDe, poserPrix }))));
}

function ligneCandidate(candidate, { champKamas, prixDe, poserPrix }) {
  const { item, remplace, gain } = candidate;
  return el('div', { class: 'transition-candidate' },
    el('div', { class: 'quoi' },
      el('span', { class: 'nom', text: item.fr }),
      el('span', { class: 'aide', text: remplace ? `à la place de ${remplace.fr}` : 'sur une case vide' }),
      el('span', { class: `aide${candidate.tropChere ? ' att' : ''}`, text: verdict(candidate) })),
    el('span', { class: 'n gain', text: `score +${nombre(gain)}` }),
    candidate.enBanque
      ? el('span', { class: 'etiquette', text: 'En banque' })
      : champKamas(`Prix de ${item.fr}`, prixDe(item), (lu) => poserPrix(item, lu)));
}

/** Ce que vaut la candidate, en une phrase courte. */
function verdict({ enBanque, cout, gain, tropChere }) {
  if (enBanque) return 'gratuite';
  if (cout === null) return 'sans prix';
  if (tropChere) return 'trop chère pour l\'instant';
  if (cout === 0) return 'gratuite';
  return `+${nombre((gain / cout) * 1_000_000)} de score par million, ${kamas(cout)} perdus à la fin`;
}
