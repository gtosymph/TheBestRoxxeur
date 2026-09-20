/**
 * La forgemagie que le moteur decide lui-meme.
 *
 * Le joueur pose ses exos piece par piece. Ce module fait l'autre moitie : il
 * regarde ce que l'objectif paie, ce que chaque piece porte deja, et il pousse
 * la ligne qui rapporte le plus pour le poids disponible.
 *
 * Il ne triche pas avec les regles du jeu :
 *
 *   - une piece n'accepte que cent un de poids d'over et d'exo reunis, et ce
 *     que le joueur a deja pose se retranche de ce budget ;
 *   - un over ne pousse qu'une ligne que la piece porte deja.
 *
 * Le choix ne depend que de la piece et de ce que l'objectif paie : il se
 * calcule donc UNE fois pour tout le catalogue, avant la recherche, et ne
 * coute plus rien ensuite. C'est ce qui permet au solveur de chercher parmi
 * des pieces forgees sans payer une decision de forgemagie par evaluation.
 */
import { BUDGET_POIDS, POIDS_RUNE, choisirOver, poidsDe } from './runes.mjs';

/**
 * Ce que pesent les lignes deja posees sur une piece.
 *
 * Une ligne qui ne se forge pas ne pese rien : elle ne vient pas d'une rune.
 *
 * @param {Record<string, number>|null|undefined} apport
 * @returns {number}
 */
export function poidsPorte(apport) {
  let total = 0;
  for (const [stat, valeur] of Object.entries(apport ?? {})) {
    if (POIDS_RUNE[stat] === undefined) continue;
    total += poidsDe(stat, Math.abs(Number(valeur) || 0));
  }
  return total;
}

/**
 * Decide la forgemagie de chaque piece.
 *
 * @param {object} entree
 * @param {any[]} entree.items Pieces a forger.
 * @param {Record<string, number>} entree.valeurs Ce que vaut UN point, par caracteristique.
 * @param {number} [entree.budget] Poids permis par piece.
 * @param {Map<number, Record<string, number>>|null} [entree.exos] Ce que le joueur a deja pose.
 * @returns {{table: Map<number, Record<string, number>>,
 *   overs: {id: number, stat: string, valeur: number}[]}}
 */
export function forgerAuto({ items, valeurs, budget = BUDGET_POIDS, exos = null }) {
  const table = new Map();
  const overs = [];

  for (const item of items ?? []) {
    if (!item || table.has(item.id)) continue;

    const reste = budget - poidsPorte(exos?.get(item.id));
    const choix = choisirOver(item, valeurs, reste);
    if (!choix) continue;

    table.set(item.id, { [choix.stat]: choix.valeur });
    overs.push({ id: item.id, stat: choix.stat, valeur: choix.valeur });
  }

  return { table, overs };
}

/**
 * Reunit deux tables d'exos en une troisieme, sans toucher aux deux premieres.
 *
 * @param {Map<number, Record<string, number>>|null} premiere
 * @param {Map<number, Record<string, number>>|null} seconde
 * @returns {Map<number, Record<string, number>>}
 */
export function fusionnerExos(premiere, seconde) {
  const fusion = new Map();
  for (const [id, apport] of premiere ?? []) fusion.set(id, { ...apport });

  for (const [id, apport] of seconde ?? []) {
    const deja = fusion.get(id);
    if (!deja) { fusion.set(id, { ...apport }); continue; }

    const somme = { ...deja };
    for (const [stat, valeur] of Object.entries(apport)) {
      somme[stat] = (somme[stat] ?? 0) + valeur;
    }
    fusion.set(id, somme);
  }

  return fusion;
}
