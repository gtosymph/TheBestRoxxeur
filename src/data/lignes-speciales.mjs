/**
 * Les lignes de degats que les donnees du jeu ne decrivent pas.
 *
 * Les effets bruts disent combien un sort frappe, pas toujours QUAND. Un
 * poison de debut de tour et un coup declenche par un etat s'y ecrivent
 * comme un coup du tour, et le moteur les comptait au tour meme. Cette table
 * ecrit ces faits a la main, sort par sort, d'apres la fiche du jeu.
 *
 * Chaque entree agit sur les lignes deja lues :
 *   - `differe` marque une ligne comme touchant N tours apres le lancer ;
 *   - `conditions` ajoute la copie d'une ligne, qui ne tombe que sous une
 *     condition que le joueur choisit de compter ou non.
 */

/**
 * @typedef {object} EntreeSpeciale
 * @property {string} nom Nom du sort, pour la relecture.
 * @property {string} pourquoi Ce que la fiche du jeu dit.
 * @property {{rang: number, tours: number}[]} [differe]
 * @property {{rang: number, condition: string}[]} [conditions]
 */

/** @type {Readonly<Record<number, EntreeSpeciale>>} */
export const LIGNES_SPECIALES = Object.freeze({
  13244: Object.freeze({
    nom: 'Aiguille',
    pourquoi: 'La fiche du jeu decrit un poison Terre de debut de tour, puis des '
      + 'dommages Terre si la cible perd l\'etat Telefrag, une fois par tour.',
    differe: [{ rang: 0, tours: 1 }],
    conditions: [{ rang: 0, condition: 'Si la cible perd le Téléfrag' }],
  }),
});

/**
 * Rend les lignes d'un sort, corrigees par la table.
 *
 * Les lignes recues ne changent jamais. Un sort absent de la table rend la
 * meme liste. Une liste deja corrigee ne se corrige pas deux fois : l'import
 * peut repasser dessus sans dedoubler un coup.
 *
 * @param {number} idSort
 * @param {any[]} lignes
 * @returns {any[]}
 */
export function avecLignesSpeciales(idSort, lignes) {
  const entree = LIGNES_SPECIALES[idSort];
  if (!entree) return lignes;
  if (lignes.some((ligne) => ligne.condition)) return lignes;

  const tours = new Map((entree.differe ?? []).map(({ rang, tours: n }) => [rang, n]));
  const corrigees = lignes.map((ligne, rang) => (tours.has(rang)
    ? { ...ligne, differe: tours.get(rang) }
    : ligne));

  const ajoutees = (entree.conditions ?? [])
    .filter(({ rang }) => lignes[rang])
    .map(({ rang, condition }) => {
      const { differe, ...coup } = lignes[rang];
      return { ...coup, condition };
    });

  return [...corrigees, ...ajoutees];
}
