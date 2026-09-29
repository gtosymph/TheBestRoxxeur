/**
 * Les sorts dans le lien de partage.
 *
 * Un sort du jeu voyage par son identifiant : le catalogue le refabrique a
 * l'arrivee, a la bonne variante. Deux choix du joueur voyagent avec lui
 * quand il les a faits : le nombre de lancers comptes, et le choix de
 * compter ses lignes speciales. Sans eux, le lien reposait la meme question
 * avec d'autres chiffres.
 *
 * Un sort ecrit par le joueur ne se refabrique pas : sa fiche entiere
 * voyage, sous une forme courte, dans le champ `perso`.
 */
import {
  compacterSortPerso, decompacterSortPerso, estSortPerso,
} from '../src/data/sort-perso.mjs';

/** Choix de lignes speciales, en un chiffre : -1 sans choix, 0 non, 1 oui. */
const codeSpeciales = (sort) => (typeof sort.speciales === 'boolean' ? Number(sort.speciales) : -1);

/** Les choix du joueur, ou null quand il n'en a fait aucun. */
function choixDe(sort) {
  const repeats = Number.isFinite(sort.repeats) && sort.repeats > 1 ? sort.repeats : 0;
  const speciales = codeSpeciales(sort);
  return repeats === 0 && speciales === -1 ? null : [repeats, speciales];
}

/** Relit les choix d'un sort. */
function choixLus(repeats, speciales) {
  return {
    ...(Number.isInteger(repeats) && repeats > 1 ? { repeats } : {}),
    ...(speciales === 0 || speciales === 1 ? { speciales: speciales === 1 } : {}),
  };
}

/**
 * Les champs du lien pour une liste de sorts.
 *
 * @param {any[]} sorts
 * @returns {{sorts?: any[], perso?: any[]}}
 */
export function sortsPartages(sorts) {
  const liste = sorts ?? [];
  const duJeu = liste.filter((sort) => !estSortPerso(sort));
  const perso = liste.filter(estSortPerso);

  return {
    ...(duJeu.length > 0 ? {
      sorts: duJeu.map((sort) => {
        const choix = choixDe(sort);
        return choix ? [sort.id, ...choix] : sort.id;
      }),
    } : {}),
    ...(perso.length > 0 ? {
      perso: perso.map((sort) => [...compacterSortPerso(sort), ...(choixDe(sort) ?? [])]),
    } : {}),
  };
}

/**
 * Les sorts d'un lien, dans la forme rangee.
 *
 * Un sort du jeu ne porte que son identifiant et les choix du joueur : le
 * catalogue le refabrique. Une entree abimee se laisse de cote.
 *
 * @param {{sorts?: any[], perso?: any[]}} forme
 * @returns {any[]}
 */
export function sortsRanges(forme) {
  const duJeu = (Array.isArray(forme?.sorts) ? forme.sorts : [])
    .map((entree) => (Array.isArray(entree)
      ? { id: entree[0], ...choixLus(entree[1], entree[2]) }
      : { id: entree }))
    .filter((sort) => Number.isFinite(sort.id));

  const perso = (Array.isArray(forme?.perso) ? forme.perso : [])
    .map((entree, rang) => {
      const sort = decompacterSortPerso(entree, rang);
      return sort ? { ...sort, ...choixLus(entree[5], entree[6]) } : null;
    })
    .filter(Boolean);

  return [...duJeu, ...perso];
}
