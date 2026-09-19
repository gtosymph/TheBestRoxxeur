/**
 * La borne haute des degats.
 *
 * Le solveur rend un stuff et un chiffre, et le joueur ne sait jamais si ce
 * chiffre est bon. Une borne le dit : aucun stuff de ce niveau, avec ces
 * sorts et contre cette cible, ne depasse ce nombre. Le vrai optimum est
 * dessous, et l'ecart entre les deux dit combien il reste a chercher.
 *
 * C'est une RELAXATION, jamais un stuff : chaque case prend le meilleur de
 * chaque statistique parmi les pieces portables, sans tenir compte des
 * conditions, des cumuls de panoplie ni du fait qu'une seule piece ne porte
 * pas tous ces maximums a la fois. Les points de caracteristique vont tous
 * dans chaque caracteristique en meme temps. Chaque simplification ne peut
 * que hausser le nombre : c'est ce qui en fait une borne.
 */
import { buildPools } from './genome.mjs';
import { damageValue } from './score.mjs';
import { derive } from '../engine/build.mjs';
import { SCROLLABLE, SCROLL_BONUS, availablePoints, maxForBudget } from '../engine/characteristics.mjs';
import { emptyStats } from '../data/stats.mjs';

/**
 * Le plus haut de chaque statistique parmi des pieces, `places` fois.
 *
 * Une case ne porte qu'une piece, mais deux anneaux et six dofus partagent
 * un meme vivier : la meme piece ne peut pas remplir les six cases. Chaque
 * statistique prend donc la somme de ses `places` meilleures valeurs, sur
 * des pieces DISTINCTES. Sans cela, le meilleur trophee compte six fois et
 * la borne s'envole sans rien dire.
 */
function maximaDe(pieces, places = 1) {
  const parStat = new Map();
  for (const piece of pieces) {
    for (const [cle, valeur] of Object.entries(piece?.stats ?? {})) {
      const n = Number(valeur);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (!parStat.has(cle)) parStat.set(cle, []);
      parStat.get(cle).push(n);
    }
  }
  const maxima = {};
  for (const [cle, valeurs] of parStat) {
    valeurs.sort((a, b) => b - a);
    maxima[cle] = valeurs.slice(0, places).reduce((somme, n) => somme + n, 0);
  }
  return maxima;
}

/** Le plus haut palier de chaque panoplie, toutes panoplies confondues. */
function maximaPanoplies(setById) {
  const paliers = [];
  for (const set of setById?.values?.() ?? []) {
    for (const tier of set?.tiers ?? []) paliers.push({ stats: tier });
  }
  return maximaDe(paliers);
}

/**
 * Les statistiques brutes relachees : ce qu'aucun stuff ne depasse.
 *
 * @param {object} reglages
 * @param {any[]} reglages.items Catalogue complet.
 * @param {number} reglages.level
 * @param {Map<number, any>} reglages.setById
 * @param {Set<number>} [reglages.banned]
 * @param {Record<string, boolean>} [reglages.scrolls]
 * @param {boolean} [reglages.allowUnobtainable]
 * @returns {Record<string, number>}
 */
export function statsRelachees({ items, level, setById, banned = new Set(), scrolls = {}, allowUnobtainable = false }) {
  const { layout, pools } = buildPools(items ?? [], { level, banned, allowUnobtainable });
  const stats = emptyStats();
  const ajouter = (maxima) => {
    for (const [cle, valeur] of Object.entries(maxima)) stats[cle] = (stats[cle] ?? 0) + valeur;
  };

  // Un vivier par emplacement, avec autant de places que de cases.
  const places = new Map();
  layout.forEach((cell, i) => {
    const deja = places.get(cell.slotKey);
    places.set(cell.slotKey, deja ? { ...deja, n: deja.n + 1 } : { pool: pools[i], n: 1 });
  });
  for (const { pool, n } of places.values()) ajouter(maximaDe(pool, n));
  ajouter(maximaPanoplies(setById));

  const budget = availablePoints(level);
  for (const caracteristique of SCROLLABLE) {
    if (scrolls[caracteristique]) stats[caracteristique] += SCROLL_BONUS;
    stats[caracteristique] += maxForBudget(caracteristique, budget);
  }
  return stats;
}

/**
 * Les degats qu'aucun stuff ne depasse, ou null sans sort.
 *
 * @param {object} reglages Ceux de `statsRelachees`, plus l'objectif.
 * @param {{spells?: any[], cible?: Record<string, number>|null, menace?: any}} reglages.objective
 * @returns {number|null}
 */
export function borneDegats({ objective, ...reste }) {
  const spells = objective?.spells ?? [];
  if (spells.length === 0) return null;
  const stats = derive(statsRelachees(reste), reste.level, objective.menace);
  return damageValue(spells, stats, objective.cible ?? null).total;
}
