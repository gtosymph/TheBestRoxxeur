/**
 * Ce qu'une infobulle dit d'un sort.
 *
 * Le volet gauche ne montre qu'un nom et une icone. Le joueur qui hesite
 * entre deux sorts n'a alors rien a lire : ni ce que le sort coute, ni ce
 * qu'il frappe, ni ce qu'il rapporte AVEC son stuff. Ce module rend ces trois
 * reponses, sous forme de texte deja pret. Il ne touche pas au document :
 * c'est ce qui permet de le verifier sans navigateur.
 */
import { computeSpell } from '../src/engine/damage.mjs';

const ENTIER = (v) => Math.round(v).toLocaleString('fr-FR');

/** « 33–36 », ou « 33 » quand les deux bornes se rejoignent. */
const plage = (min, max) => (min === max ? String(min) : `${min}–${max}`);

/**
 * Le cout et les limites du sort, en phrases courtes.
 *
 * @param {any} sort Sort au format du moteur.
 * @param {any} [fiche] Entree du catalogue, pour la portee.
 * @returns {string[]}
 */
export function coutDuSort(sort, fiche = null) {
  const morceaux = [];
  const pa = Number(sort?.apCost) || 0;
  if (pa > 0) morceaux.push(`${pa} PA`);

  const max = Number(fiche?.range);
  if (Number.isFinite(max) && max > 0) {
    const min = Number(fiche?.minRange) || 0;
    morceaux.push(`portée ${min === max ? max : `${min}–${max}`}`);
  }

  const lancers = Number(sort?.castsPerTurn) || 1;
  morceaux.push(lancers > 1 ? `${lancers} lancers par tour` : '1 lancer par tour');

  const crit = Number(sort?.baseCrit) || 0;
  if (crit > 0) morceaux.push(`${crit} % de critique`);

  if (fiche?.zone) morceaux.push(`zone ${fiche.zone}`);
  return morceaux;
}

/**
 * Les lignes de degats du sort, telles que le jeu les ecrit.
 *
 * @param {any} sort
 * @returns {{element: string, normal: string, critique: string, differe: number}[]}
 */
export function lignesDuSort(sort) {
  return (sort?.lines ?? []).map((ligne) => ({
    element: ligne.element,
    normal: plage(ligne.min, ligne.max),
    critique: plage(ligne.critMin ?? ligne.min, ligne.critMax ?? ligne.max),
    differe: Number(ligne.differe) || 0,
  }));
}

/**
 * Ce que le sort rapporte avec le stuff porte.
 *
 * Sans statistiques, il n'y a rien a dire : le sort nu ne se compare a rien.
 *
 * @param {any} sort
 * @param {Record<string, number>|null} stats
 * @param {Record<string, number>|null} [cible] Resistances de la cible.
 * @returns {{moyenne: number, parTour: number, parPa: number|null}|null}
 */
export function renduDuSort(sort, stats, cible = null) {
  if (!stats || (sort?.lines ?? []).length === 0) return null;
  const detail = computeSpell(sort, stats, cible);
  return {
    moyenne: detail.average,
    parTour: detail.parTour,
    parPa: detail.perAp,
  };
}

/**
 * Tout ce que l'infobulle d'un sort montre.
 *
 * @param {any} sort Sort au format du moteur.
 * @param {object} [contexte]
 * @param {Record<string, number>|null} [contexte.stats] Statistiques du build porte.
 * @param {Record<string, number>|null} [contexte.cible] Resistances de la cible.
 * @param {any} [contexte.fiche] Entree du catalogue des sorts.
 * @returns {{nom: string, cout: string[], lignes: any[], rendu: any,
 *   phrases: string[]}|null}
 */
export function decrireSort(sort, contexte = {}) {
  if (!sort) return null;
  const rendu = renduDuSort(sort, contexte.stats ?? null, contexte.cible ?? null);

  const phrases = [];
  if (rendu) {
    phrases.push(`${ENTIER(rendu.moyenne)} en moyenne par lancer`);
    if (rendu.parPa !== null) phrases.push(`${ENTIER(rendu.parPa)} par PA`);
    if (rendu.parTour !== rendu.moyenne) phrases.push(`${ENTIER(rendu.parTour)} sur un tour`);
  }

  return {
    nom: sort.name ?? sort.fr ?? String(sort.id ?? ''),
    cout: coutDuSort(sort, contexte.fiche ?? null),
    lignes: lignesDuSort(sort),
    rendu,
    phrases,
  };
}
