/**
 * Gestes des sorts ecrits par le joueur : creer, modifier, supprimer.
 *
 * La fiche (vue-sort-perso.mjs) ne connait pas l'etat ; elle rend un sort
 * verifie. Ce module le pose dans la liste, par les gestes des sorts : un
 * premier sort bascule la recherche vers les degats, comme un sort du jeu.
 */
import { estSortPerso, nouveauSortPerso } from '../../src/data/sort-perso.mjs';
import { ouvrirSortPerso } from './vue-sort-perso.mjs';

/**
 * @param {object} liens
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 * @param {{poser: (sort: any) => void}} liens.gestesSorts
 * @returns {{creer: () => void, modifier: (id: string) => void}}
 */
export function creerGestesSortPerso({ lireEtat, setEtat, message, gestesSorts }) {
  function ouvrir(sort, existe) {
    ouvrirSortPerso({
      sort,
      existe,
      onEnregistrer: (verifie) => {
        gestesSorts.poser(verifie);
        message(existe ? `« ${verifie.name} » est modifié.` : `« ${verifie.name} » est ajouté à vos sorts.`, 'info');
      },
      onSupprimer: (id) => {
        setEtat({ sorts: lireEtat().sorts.filter((s) => s.id !== id) });
        message(`« ${sort.name} » est supprimé.`, 'info');
      },
    });
  }

  return {
    creer: () => ouvrir(nouveauSortPerso(lireEtat().sorts), false),
    modifier: (id) => {
      const sort = lireEtat().sorts.find((s) => s.id === id);
      if (estSortPerso(sort)) ouvrir(sort, true);
    },
  };
}
