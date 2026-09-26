/**
 * Ce que la liste des stuffs trouves dit d'elle-meme.
 *
 * La liste se vide au depart d'une recherche et ne se remplit qu'a la pause.
 * Elle disait toujours « Lancez une recherche » quand elle etait vide, meme
 * pendant que la recherche tournait. Et quand aucun build ne tenait les
 * minimums, rien ne reliait la liste au reglage qui bloquait.
 */

/**
 * @param {Array<{satisfied?: boolean}>} candidats
 * @param {{enRecherche: boolean}} contexte
 * @returns {{vide: string, avertissement: string|null}}
 */
export function notesDesTrouves(candidats, { enRecherche }) {
  const vide = enRecherche
    ? 'La recherche tourne. Les autres builds arrivent à la pause.'
    : 'Aucun autre build. Lancez une recherche.';
  const liste = candidats ?? [];
  const aucunTenu = liste.length > 0 && liste.every((candidat) => candidat.satisfied === false);
  const avertissement = aucunTenu
    ? 'Aucun de ces builds ne tient tous vos minimums. Baissez un chiffre dans « Au minimum » '
      + 'pour en trouver qui les tiennent.'
    : null;
  return { vide, avertissement };
}
