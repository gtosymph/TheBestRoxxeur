/**
 * Les operateurs du solveur genetique : selection, croisement, mutation et
 * secousse d'une population figee.
 */
import { EMPTY, repair } from './genome.mjs';

/**
 * Reapplique les verrous sur une graine issue du build courant.
 * @param {number[]} graine Modifiee en place.
 */
export function applyLocksSurGraine(graine, locks, layout, pools) {
  if (!locks || locks.size === 0) return;
  repair(graine, layout, pools, locks);
}

/**
 * Selectionne un parent par tournoi.
 * @param {{genome: number[], score: number}[]} population
 * @param {number} size
 * @param {() => number} random
 */
export function tournament(population, size, random) {
  let best = population[Math.floor(random() * population.length)];
  for (let i = 1; i < size; i += 1) {
    const challenger = population[Math.floor(random() * population.length)];
    if (challenger.score > best.score) best = challenger;
  }
  return best;
}

/**
 * Croise deux genomes case par case.
 * @param {number[]} a
 * @param {number[]} b
 * @param {() => number} random
 * @returns {number[]}
 */
export function crossover(a, b, random) {
  const child = new Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    child[i] = random() < 0.5 ? a[i] : b[i];
  }
  return child;
}

/**
 * Applique des mutations sur un genome.
 * @param {number[]} genome Modifie en place.
 * @param {any[][]} pools
 * @param {number} rate
 * @param {() => number} random
 */
export function mutate(genome, pools, rate, random, guidage = null) {
  for (let i = 0; i < genome.length; i += 1) {
    if (random() > rate) continue;

    const pool = pools[i];
    if (pool.length === 0) {
      genome[i] = EMPTY;
      continue;
    }

    // Une mutation vide parfois la case pour explorer les builds incomplets.
    if (random() < 0.08) {
      genome[i] = EMPTY;
      continue;
    }

    // Une mutation orientee pioche dans la tete du classement : les pieces
    // qui servent le mieux les conditions. Le reste du temps elle tire au
    // hasard, ce qui preserve l'exploration.
    const rangs = guidage?.rankings?.[i];
    if (rangs && rangs.length > 0 && random() < guidage.rate) {
      const tete = Math.min(guidage.size, rangs.length);
      genome[i] = rangs[Math.floor(random() * tete)];
      continue;
    }

    genome[i] = Math.floor(random() * pool.length);
  }
  return genome;
}

/**
 * Secoue un genome : deux a quatre cases changent d'un coup.
 *
 * Le tirage suit le meme guidage que les mutations orientees : la piece de
 * remplacement vient le plus souvent de la tete du classement.
 *
 * @param {number[]} genome Non modifie.
 * @returns {number[]} Une copie secouee.
 */
export function secouer(genome, pools, random, guidage, locks = null, force = 0) {
  const copie = [...genome];
  const nb = 2 + Math.floor(random() * 3) + force;

  for (let coup = 0; coup < nb; coup += 1) {
    const cellule = Math.floor(random() * copie.length);
    if (locks?.has(cellule) || pools[cellule].length === 0) continue;

    const rangs = guidage?.rankings?.[cellule];
    if (rangs && rangs.length > 0 && random() < 0.7) {
      const tete = Math.min(guidage.size, rangs.length);
      copie[cellule] = rangs[Math.floor(random() * tete)];
    } else {
      copie[cellule] = Math.floor(random() * pools[cellule].length);
    }
  }

  return copie;
}

/**
 * Lance la recherche du meilleur build.
 *
 * @param {object} input
 * @param {any[]} input.items Catalogue d'items.
 * @param {Map<number, any>} input.setById Panoplies indexees.
 * @param {number} input.level Niveau du personnage.
 * @param {object} input.objective Conditions, sorts et mode de recherche.
 * @param {Record<string, number>} [input.allocation]
 * @param {Record<string, boolean>} [input.scrolls]
 * @param {Map<number, Record<string, number>>} [input.passives] Passifs actifs.
 * @param {number[]} [input.lockedIds] Items imposes dans le build.
 * @param {Set<number>} [input.banned]
 * @param {Set<string>} [input.allowedSlots]
 * @param {Partial<typeof DEFAULT_OPTIONS>} [options]
 * @param {(progress: {generation: number, best: number}) => void} [onProgress]
 * @returns {{items: any[], stats: any, score: number, detail: any, generations: number}}
 */
