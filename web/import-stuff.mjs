/**
 * Ce qu'un stuff importe change dans l'etat.
 *
 * Un stuff qui arrive de Dofusbook est celui que le joueur porte VRAIMENT en
 * jeu — c'est pour cela qu'il l'a pris la-bas. Il devient donc a la fois le
 * stuff porte, pose a la main piece par piece, et le stuff de reference face
 * auquel le panneau des achats compte. Les paliers d'avant tombent : ils
 * comptaient face a l'ancienne reference.
 */
import { SLOTS } from '../src/data/slots.mjs';

/**
 * Patch d'etat pour un stuff importe.
 *
 * @param {any} etat
 * @param {{itemIds: number[], niveau?: number, allocation?: Record<string, number>,
 *   scrolls?: Record<string, boolean>}} importe
 * @param {Map<number, any>} itemById
 * @param {Date} [date] Moment du figeage de la reference.
 * @returns {(Record<string, any> & {laisses: number[]})|null} Null quand
 *   aucune piece n'est connue : il n'y a rien a poser.
 */
export function patchImport(etat, importe, itemById, date = new Date()) {
  const equipped = new Map();
  const restant = new Map(SLOTS.map((s) => [s.key, s.capacity]));
  const laisses = [];

  for (const id of importe.itemIds ?? []) {
    const item = itemById.get(id);
    const libre = item ? (restant.get(item.slot) ?? 0) : 0;
    if (!item || libre <= 0) { laisses.push(id); continue; }
    const slot = SLOTS.find((s) => s.key === item.slot);
    equipped.set(`${item.slot}:${slot.capacity - libre}`, item);
    restant.set(item.slot, libre - 1);
  }
  if (equipped.size === 0) return null;

  const itemIds = [...equipped.values()].map((piece) => piece.id);
  return {
    equipped,
    posees: new Set(equipped.keys()),
    verrous: new Set([...(etat.verrous ?? [])].filter((id) => itemIds.includes(id))),
    reference: { itemIds, date: date.toISOString() },
    paliers: [],
    ...(importe.niveau ? { niveau: importe.niveau } : {}),
    ...(importe.allocation ? { allocation: { ...etat.allocation, ...importe.allocation } } : {}),
    ...(importe.scrolls ? { scrolls: { ...etat.scrolls, ...importe.scrolls } } : {}),
    laisses,
  };
}
