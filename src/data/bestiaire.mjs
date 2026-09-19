/**
 * Le bestiaire : lire data/monsters.json et y choisir une cible.
 *
 * Le fichier est serre (voir scripts/fetch-monsters.mjs) : chaque grade est
 * un tableau plat [grade, niveau, pdv, neutre, terre, feu, eau, air]. Ce
 * module est le seul a connaitre cet ordre. Tout le reste de l'outil parle
 * de resistances par element nomme, comme la cible (src/engine/cible.mjs).
 */
import { ELEMENTS } from './stats.mjs';

/** Place des resistances dans le tableau plat d'un grade. */
const PREMIERE_RESISTANCE = 3;

/**
 * Les grades d'un monstre, lisibles.
 * @param {any} monstre Entree de data/monsters.json.
 * @returns {{grade: number, niveau: number, pdv: number, res: Record<string, number>}[]}
 */
export function gradesDe(monstre) {
  if (!Array.isArray(monstre?.grades)) return [];
  return monstre.grades
    .filter((g) => Array.isArray(g) && g.length >= PREMIERE_RESISTANCE + ELEMENTS.length)
    .map((g) => ({
      grade: g[0],
      niveau: g[1],
      pdv: g[2],
      res: Object.fromEntries(ELEMENTS.map((element, i) => [element, g[PREMIERE_RESISTANCE + i]])),
    }));
}

/**
 * Un monstre a un grade, tel que la cible le garde.
 *
 * Un grade qui n'existe pas rend le plus haut : c'est celui que le joueur
 * rencontre le plus souvent, et celui qui resiste le plus.
 *
 * @param {any} monstre
 * @param {number} grade
 * @returns {{id: number, nom: string, grade: number, niveau: number, res: Record<string, number>}|null}
 */
export function versCible(monstre, grade) {
  const grades = gradesDe(monstre);
  if (grades.length === 0) return null;
  const choisi = grades.find((g) => g.grade === grade) ?? grades[grades.length - 1];
  return { id: monstre.id, nom: monstre.nom, grade: choisi.grade, niveau: choisi.niveau, res: choisi.res };
}

/** Niveau qu'un monstre affiche dans la liste : celui de son premier grade. */
export function niveauDe(monstre) {
  return gradesDe(monstre)[0]?.niveau ?? 0;
}

/** Une chaine comparable : sans accents, sans casse. */
const plat = (texte) => String(texte ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Resultats montres au plus : au-dela, le joueur affine sa recherche. */
export const RESULTATS_MAX = 60;

/**
 * Les monstres qui repondent a la recherche, boss en tete.
 *
 * @param {any[]} liste Le bestiaire.
 * @param {{terme?: string, boss?: boolean, niveauMin?: number, niveauMax?: number}} filtre
 * @param {number} [max]
 * @returns {any[]}
 */
export function chercherMonstres(liste, filtre = {}, max = RESULTATS_MAX) {
  const terme = plat(filtre.terme).trim();
  const min = Number.isFinite(filtre.niveauMin) ? filtre.niveauMin : -Infinity;
  const maxNiveau = Number.isFinite(filtre.niveauMax) ? filtre.niveauMax : Infinity;

  return (Array.isArray(liste) ? liste : [])
    .filter((m) => {
      if (filtre.boss && !(m.boss > 0)) return false;
      const niveau = niveauDe(m);
      if (niveau < min || niveau > maxNiveau) return false;
      return terme === '' || plat(m.nom).includes(terme);
    })
    .sort((a, b) => (b.boss ?? 0) - (a.boss ?? 0) || niveauDe(b) - niveauDe(a) || plat(a.nom).localeCompare(plat(b.nom)))
    .slice(0, max);
}
