/**
 * Les essais gardes : ranger le stuff porte, et le reposer plus tard.
 */
import { buildCourant, scoreAffiche } from '../objectif.mjs';
import { ajouterSimulation } from '../simulations.mjs';
import { instantane, patchDepuisSimulation } from '../instantane.mjs';

import { nombre } from './nombres.mjs';

/**
 * @param {object} liens
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 * @param {() => any} liens.lireCatalogue
 * @param {() => {rafraichir: () => void}|null} liens.lirePanneau
 */
export function creerEssais({ lireEtat, setEtat, message, lireCatalogue, lirePanneau }) {
  /**
   * Range le stuff porte parmi les essais gardes.
   *
   * `siNouvelle` evite d'empiler quarante fois le meme stuff : la recherche
   * appelle cette fonction a chaque amelioration.
   */
  function garderSimulation(choix = {}) {
    const etat = lireEtat();
    const build = buildCourant(etat, lireCatalogue());
    if (!build) {
      message('Rien à garder : le catalogue n\'est pas encore charge.');
      return;
    }

    let ajoutee = null;
    try {
      ({ ajoutee } = ajouterSimulation(
        instantane(etat, build, scoreAffiche(etat, build.stats)),
        { siNouvelle: choix.siNouvelle }));
    } catch (erreur) {
      message(erreur.message, 'erreur');
      return;
    }

    lirePanneau()?.rafraichir();
    if (choix.silencieux || !ajoutee) return;
    message(`Essai gardé à ${nombre(Math.floor(ajoutee.score))} dégâts.`);
  }

  /** Repose un essai garde sur le personnage. */
  function restaurerSimulation(simulation) {
    const catalogue = lireCatalogue();
    if (!catalogue) return;
    const { patch, manquantes } = patchDepuisSimulation(lireEtat(), simulation, catalogue.itemById);
    setEtat(patch);
    message(manquantes === 0
      ? 'Essai reposé. « Annuler » revient au stuff d\'avant.'
      : `Essai reposé. ${manquantes} pièce(s) introuvable(s) au catalogue.`,
    manquantes === 0 ? 'info' : 'erreur');
  }

  return { garderSimulation, restaurerSimulation };
}
