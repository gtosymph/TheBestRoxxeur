/**
 * Poser et enlever un minimum depuis l'ecran principal.
 *
 * La feuille « Regler mes minimums » reste l'endroit du reglage complet ; ces
 * deux gestes sont les raccourcis de la fiche et de la liste des minimums.
 */
import { STAT_LABELS } from '../../src/data/stats.mjs';
import { MINIMUM_NEUF } from './vue-minimums.mjs';
import { nombre } from './nombres.mjs';

/** Forme d'un minimum pose a la main : la meme que dans la feuille. */
const POIDS_PAR_DEFAUT = (stat, target) => ({ ...MINIMUM_NEUF(stat), target });

const libelle = (stat) => STAT_LABELS[stat] ?? stat;

/**
 * @param {object} liens
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 */
export function creerGestesMinimums({ lireEtat, setEtat, message }) {
  /**
   * Pose un minimum a la valeur atteinte, ou le remonte s'il existe deja.
   *
   * Cliquer un chiffre deja sous minimum n'est pas une erreur : c'est un joueur
   * qui vient de gagner de la valeur et veut la garder. Le minimum monte alors
   * a ce qu'il a maintenant, jamais il ne redescend.
   */
  function poserMinimum(stat, valeur) {
    const etat = lireEtat();
    const cible = Math.round(Number(valeur) || 0);
    const deja = etat.conditions.find((c) => c.stat === stat);

    if (!deja) {
      setEtat({ conditions: [...etat.conditions, POIDS_PAR_DEFAUT(stat, cible)] });
      message(`Garde au moins ${nombre(cible)} de ${libelle(stat).toLowerCase()}.`);
      return;
    }

    if (cible <= deja.target) {
      message(`${libelle(stat)} est déjà gardé à ${nombre(deja.target)} au moins.`);
      return;
    }
    setEtat({
      conditions: etat.conditions.map((c) => (c.stat === stat ? { ...c, target: cible } : c)),
    });
    message(`${libelle(stat)} : le minimum monte à ${nombre(cible)}.`);
  }

  /** Enleve un minimum. */
  function enleverMinimum(stat) {
    setEtat({ conditions: lireEtat().conditions.filter((c) => c.stat !== stat) });
    message(`${libelle(stat)} n'est plus un minimum.`);
  }

  return { poserMinimum, enleverMinimum };
}
