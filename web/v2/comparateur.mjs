/**
 * Les stuffs coches, et leur comparaison avec le stuff porte.
 *
 * Une seule table pour les trois listes : on compare un stuff trouve avec un
 * palier d'achat et un essai garde, ce qu'aucune des trois ne permettait
 * separement. La cle est le STUFF et sa liste (`cleDeChoix`), jamais l'objet :
 * les listes recreent leurs objets a chaque dessin, et une cle par objet
 * gardait des coches que plus aucune case ne montrait.
 */
import { appliquerBuild } from '../equipement.mjs';
import { attaquesAffichees, buildCourant, cibleDe, exosDe } from '../objectif.mjs';
import { lireSimulations } from '../simulations.mjs';
import { damageValue } from '../../src/solver/score.mjs';

import { ouvrirComparaison } from './vue-comparaison.mjs';
import { libellesForge, mesuresDegats, ordonnerPieces, valeursDegats } from './comparaison.mjs';
import { basculerChoix, cleDeChoix, rafraichirChoix } from './choix-comparaison.mjs';
import { FAMILLES } from './fiche.mjs';

/**
 * Toutes les mesures de la fiche, dans l'ordre du jeu.
 *
 * La comparaison les parcourt toutes : c'est elle qui masque ce qui ne varie
 * pas, pas la liste qui choisit d'avance ce qui merite d'etre compare.
 */
const MESURES_COMPARABLES = FAMILLES.flatMap(([famille, paires]) =>
  paires.map(([cle, libelle]) => ({ cle, libelle, famille })));

/**
 * @param {object} liens
 * @param {() => any} liens.lireEtat
 * @param {() => any} liens.lireCatalogue
 * @param {() => void} liens.render
 */
export function creerComparateur({ lireEtat, lireCatalogue, render }) {
  let choisis = new Map();

  /** Ce que les listes montrent en ce moment, pour rafraichir les coches. */
  function stuffsVisibles() {
    const etat = lireEtat();
    return [
      ...(etat.candidats ?? []).map((objet) => ({ objet, famille: 'trouve' })),
      ...(etat.paliers ?? []).map((objet) => ({ objet, famille: 'palier' })),
      ...lireSimulations().map((objet) => ({ objet, famille: 'essai' })),
    ];
  }

  /** Coche ou decoche un stuff, d'ou qu'il vienne. */
  function basculerChoisi(objet, famille, nom) {
    choisis = basculerChoix(choisis, objet, famille, nom);
    render();
  }

  /** Les coches d'une liste, telles que ses cases les lisent. */
  function selectionDe(famille, nommer) {
    return {
      choisis: { has: (objet) => choisis.has(cleDeChoix(objet, famille)) },
      onBasculer: (objet) => basculerChoisi(objet, famille, nommer(objet)),
    };
  }

  /**
   * Avant de dessiner : une coche dont le stuff a quitte l'ecran s'oublie,
   * sinon la comparaison compterait un stuff que plus aucune case ne montre.
   */
  function rafraichir() {
    choisis = rafraichirChoix(choisis, stuffsVisibles());
  }

  /**
   * Une colonne de la comparaison : ses statistiques, ses degats, ses pieces.
   *
   * Un essai garde porte ses statistiques : ce sont celles qu'il AVAIT, et les
   * recalculer aujourd'hui donnerait autre chose si les points ou les options
   * ont bouge depuis. Un candidat ou un palier n'en porte pas : on repose son
   * stuff sur une copie de l'etat et on laisse le moteur faire le calcul.
   *
   * Les degats se comptent toujours avec les sorts du jour : c'est la question
   * que le joueur pose maintenant, et l'arme de la colonne — pas celle portee —
   * frappe quand l'option la compte.
   *
   * @param {string} nom
   * @param {any|null} objet Stuff coche, ou null pour le stuff porte.
   */
  function colonneDe(nom, objet) {
    const etat = lireEtat();
    const catalogue = lireCatalogue();
    const ids = objet ? (objet.itemIds ?? (objet.pieces ?? []).map((p) => p.id)) : null;
    const etatCol = objet
      ? { ...etat, ...appliquerBuild(etat, { ...objet, itemIds: ids }, catalogue.itemById) }
      : etat;
    const stats = objet?.stats ?? buildCourant(etatCol, catalogue)?.stats ?? {};
    const degats = damageValue(attaquesAffichees(etatCol), stats, cibleDe(etat));
    const pieces = ordonnerPieces([...etatCol.equipped.values()]);
    return {
      nom,
      stats: { ...stats, ...valeursDegats(degats, etat.sorts.length, etat.options.arme) },
      pieces,
      // La forgemagie de la colonne : celle du joueur, plus celle que le
      // moteur decide quand le mode automatique est allume.
      exos: libellesForge(exosDe(etatCol, catalogue), pieces),
    };
  }

  /** Ouvre la comparaison du stuff porte et des stuffs coches. */
  function comparer() {
    if (choisis.size === 0) return;
    const etat = lireEtat();

    ouvrirComparaison({
      mesures: [...mesuresDegats(etat.sorts, etat.options.arme), ...MESURES_COMPARABLES],
      colonnes: [
        colonneDe('Porté', null),
        ...[...choisis.values()].map(({ objet, nom }) => colonneDe(nom, objet)),
      ],
      minimums: new Set(etat.conditions.map((c) => c.stat)),
    });
  }

  /** Le bandeau de comparaison : il ne parait qu'avec quelque chose a comparer. */
  function renderComparer(bouton) {
    bouton.hidden = choisis.size === 0;
    bouton.textContent = `Comparer ${choisis.size + 1}`;
    bouton.title = 'Compare le stuff porté et les stuffs cochés, d\'où qu\'ils viennent.';
  }

  return { selectionDe, rafraichir, comparer, renderComparer };
}
