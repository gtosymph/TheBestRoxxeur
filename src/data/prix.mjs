/**
 * Les prix que le joueur entre a la main.
 *
 * Aucune source ouverte ne donne les prix de l'HDV : le joueur les lit en jeu
 * et les tape. Un prix vaut donc avec sa date, parce que le marche bouge ; un
 * prix ancien se signale, sans se refuser.
 *
 * La table est un objet simple, { id: { kamas, date } }, pour passer tel quel
 * dans le rangement du navigateur. Elle ne se modifie jamais en place.
 */

/** Age, en jours, a partir duquel un prix se signale. */
export const JOURS_AVANT_PEREMPTION = 7;

const JOUR_MS = 24 * 60 * 60 * 1000;

const MULTIPLICATEURS = Object.freeze({ '': 1, k: 1_000, m: 1_000_000 });

/**
 * Lit des kamas tels que le joueur les ecrit : « 1 500 000 », « 1,5m », « 800k ».
 *
 * @param {any} brut
 * @returns {number|null} Kamas entiers, ou null pour une saisie absurde.
 */
export function lireKamas(brut) {
  if (typeof brut === 'number') return Number.isFinite(brut) && brut >= 0 ? Math.round(brut) : null;
  if (typeof brut !== 'string') return null;

  const texte = brut.replace(/[\s  ]/g, '').toLowerCase().replace(',', '.');
  const trouve = /^(\d+(?:\.\d+)?)([km]?)$/.exec(texte);
  if (!trouve) return null;
  return Math.round(Number(trouve[1]) * MULTIPLICATEURS[trouve[2]]);
}

/**
 * Pose, ou enleve, le prix d'une piece.
 *
 * @param {Record<string, {kamas: number, date: number}>} table
 * @param {number} id
 * @param {number|null} kamas Null enleve le prix.
 * @param {number} maintenant Horodatage en millisecondes.
 * @returns {Record<string, {kamas: number, date: number}>} Nouvelle table.
 */
export function poserPrix(table, id, kamas, maintenant) {
  const { [id]: _ancien, ...reste } = table ?? {};
  if (kamas === null || kamas === undefined) return reste;
  return { ...reste, [id]: { kamas, date: maintenant } };
}

/**
 * Vrai quand un prix a plus de sept jours, ou n'a pas de date.
 *
 * @param {{kamas: number, date?: number}|null|undefined} entree
 * @param {number} maintenant
 */
export function prixPerime(entree, maintenant) {
  if (!entree) return false;
  if (!Number.isFinite(entree.date) || entree.date <= 0) return true;
  return maintenant - entree.date > JOURS_AVANT_PEREMPTION * JOUR_MS;
}

/**
 * Relit la table du rangement, et ne garde que les entrees saines.
 *
 * @param {any} brut
 * @returns {Record<string, {kamas: number, date: number}>}
 */
export function lireTablePrix(brut) {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {};
  const saines = Object.entries(brut).filter(([id, entree]) => /^\d+$/.test(id)
    && entree && typeof entree === 'object'
    && Number.isInteger(entree.kamas) && entree.kamas >= 0);
  return Object.fromEntries(saines.map(([id, entree]) => [
    id, { kamas: entree.kamas, date: Number.isFinite(entree.date) ? entree.date : 0 },
  ]));
}

/**
 * La table que le plan de transition lit : kamas par identifiant de piece.
 *
 * @param {Record<string, {kamas: number, date: number}>} table
 * @returns {Map<number, number>}
 */
export function prixDuPlan(table) {
  return new Map(Object.entries(table ?? {}).map(([id, entree]) => [Number(id), entree.kamas]));
}
