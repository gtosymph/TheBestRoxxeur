/**
 * Les raccourcis du clavier : la palette, l'annulation et Echap.
 */
import { fermerPalette, paletteOuverte } from './palette.mjs';
import { comparaisonOuverte, fermerComparaison } from './vue-comparaison.mjs';
import { fermerPoints, pointsOuverts } from './vue-points.mjs';
import { fermerReglages, reglagesOuverts } from './vue-reglages.mjs';
import { fermerPartage, partageOuvert } from './vue-partage.mjs';
import { caseOuverte, fermerCase } from './vue-case.mjs';
import { fermerPlus, plusOuvert } from './vue-plus.mjs';
import { comboOuvert, fermerCombo } from './vue-combo.mjs';
import { fermerVisite, visiteOuverte } from './vue-visite.mjs';
import { fermerSignaler, signalerOuvert } from './vue-signaler.mjs';
import { fermerMinimums, minimumsOuverts } from './vue-minimums.mjs';
import { fermerJournal, journalOuvert } from './vue-journal.mjs';
import { cibleOuverte, fermerCible } from './vue-cible.mjs';
import { fermerImport, importOuvert } from './vue-import.mjs';

/**
 * Ce qu'Echap ferme, dans l'ordre : la feuille du dessus d'abord.
 * Une seule par appui, pour que chaque appui se voie.
 */
const FEUILLES = Object.freeze([
  [plusOuvert, fermerPlus],
  [caseOuverte, fermerCase],
  [visiteOuverte, fermerVisite],
  [comparaisonOuverte, fermerComparaison],
  [journalOuvert, fermerJournal],
  [minimumsOuverts, fermerMinimums],
  [cibleOuverte, fermerCible],
  [importOuvert, fermerImport],
  [signalerOuvert, fermerSignaler],
  [comboOuvert, fermerCombo],
  [reglagesOuverts, fermerReglages],
  [partageOuvert, fermerPartage],
  [pointsOuverts, fermerPoints],
  [paletteOuverte, fermerPalette],
]);

/** Vrai quand la frappe va dans un champ : le raccourci ne doit pas la voler. */
function ecritDans(cible) {
  return cible instanceof HTMLElement
    && (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName));
}

/**
 * @param {object} liens
 * @param {() => void} liens.basculerPalette
 * @param {() => void} liens.annuler
 */
export function brancherClavier({ basculerPalette, annuler }) {
  // La palette s'ouvre a la touche, partout — sauf quand le joueur ecrit
  // ailleurs, ou le raccourci lui volerait sa frappe.
  window.addEventListener('keydown', (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      basculerPalette();
      return;
    }
    // Ctrl+Z annule, sauf pendant une saisie ou il annule le texte tape.
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'z') {
      if (!ecritDans(ev.target)) { ev.preventDefault(); annuler(); }
      return;
    }

    if (ev.key !== 'Escape') return;
    const ouverte = FEUILLES.find(([estOuverte]) => estOuverte());
    ouverte?.[1]();
  });
}
