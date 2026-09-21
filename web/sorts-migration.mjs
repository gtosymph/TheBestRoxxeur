/**
 * Mise a jour des sorts enregistres par une version passee.
 *
 * Un joueur revient avec des sorts ranges par une version passee. Deux
 * champs les trahissent : `exclusiveGroup` et `telefragCible`, absents des
 * anciens formats. Le catalogue corrige fait foi pour les reconstruire ; un
 * sort deja a jour reste intact, modifications du joueur comprises.
 *
 * Les LIGNES DE DEGATS se resynchronisent en plus, a chaque ouverture. Elles
 * ne sont pas un choix du joueur : elles disent ce que le jeu fait, et une
 * correction de donnees doit les atteindre. Sans cela, un joueur qui avait
 * choisi Pendule avant la correction gardait un sort qui comptait son coup
 * deux fois, pour toujours — le catalogue etait juste, son ecran mentait.
 */
import { versSortMoteur } from './spells-data.mjs';

/** Sorts du catalogue par identifiant, toutes classes confondues. */
function indexerSorts(classesSorts) {
  const parId = new Map();
  for (const classe of classesSorts ?? []) {
    for (const s of classe.spells ?? []) parId.set(s.id, s);
  }
  return parId;
}

/** Variante la plus haute accessible au niveau donne. */
function varianteAccessible(sortCatalogue, niveau) {
  const accessibles = (sortCatalogue?.variants ?? []).filter((v) => v.level <= niveau);
  return accessibles[accessibles.length - 1];
}

/** Vrai quand un sort porte tous les champs du format courant. */
const complet = (s) => s.exclusiveGroup !== undefined && s.telefragCible !== undefined;

/** Vrai quand deux jeux de lignes decrivent le meme coup. */
function memesLignes(a, b) {
  if ((a?.length ?? -1) !== b.length) return false;
  return b.every((ligne, rang) => {
    const mienne = a[rang];
    return mienne
      && mienne.element === ligne.element
      && mienne.min === ligne.min && mienne.max === ligne.max
      && mienne.critMin === ligne.critMin && mienne.critMax === ligne.critMax
      && (mienne.differe ?? 0) === (ligne.differe ?? 0);
  });
}

/**
 * Remet les lignes de degats d'un sort en accord avec le catalogue.
 *
 * Seules les lignes bougent : le nombre de lancers, la case « 1 max au
 * combo » et tout ce que le joueur a regle restent. Les lignes, elles,
 * decrivent le jeu, pas une preference.
 */
function resynchroniserLignes(sort, parId, niveau) {
  const catalogue = parId.get(sort.id);
  if (!catalogue) return sort;

  const variante = varianteAccessible(catalogue, niveau) ?? (catalogue.variants ?? [])[0];
  if (!variante) return sort;

  const { lines } = versSortMoteur({ ...catalogue, ...variante, critRate: variante.critRate });
  return memesLignes(sort.lines, lines) ? sort : { ...sort, lines };
}

/**
 * Rend les sorts au format courant, lignes de degats comprises.
 *
 * @param {any[]} sorts Sorts de l'etat.
 * @param {any[]} classesSorts Catalogue des sorts par classe.
 * @param {number} niveau Niveau du personnage.
 * @returns {{sorts: any[], changes: boolean}} Les sorts, et s'il a fallu en toucher.
 */
export function enrichirSorts(sorts, classesSorts, niveau) {
  const parId = indexerSorts(classesSorts);
  const rafraichis = sorts
    .map((sort) => (complet(sort) ? sort : refreshAncien(sort, parId, niveau)))
    .map((sort) => completerTelefrag(sort, parId, niveau))
    .map((sort) => resynchroniserLignes(sort, parId, niveau));

  const changes = rafraichis.some((sort, rang) => sort !== sorts[rang]);
  return changes ? { sorts: rafraichis, changes: true } : { sorts, changes: false };
}

/**
 * Reconstruit un sort d'avant la refonte depuis le catalogue corrige.
 *
 * Ces sorts se reconnaissent a l'absence du champ exclusiveGroup. Leurs
 * lignes de degats venaient de l'ancienne source, qui doublait certaines
 * lignes.
 */
function refreshAncien(ancien, parId, niveau) {
  if (ancien.exclusiveGroup !== undefined) return ancien;

  const catalogue = parId.get(ancien.id);
  if (!catalogue) return { ...ancien, exclusiveGroup: null };

  const variante = varianteAccessible(catalogue, niveau) ?? (catalogue.variants ?? [])[0];
  if (!variante) return { ...ancien, exclusiveGroup: catalogue.exclusiveGroup ?? null };

  return versSortMoteur({ ...catalogue, ...variante, critRate: variante.critRate });
}

/**
 * Complete le bonus « cible telefrag » d'un sort enregistre avant son
 * extraction, sans toucher au reste de sa definition.
 */
function completerTelefrag(sort, parId, niveau) {
  if (sort.telefragCible !== undefined) return sort;
  const variante = varianteAccessible(parId.get(sort.id), niveau);
  return { ...sort, telefragCible: variante?.telefragCible ?? null };
}
