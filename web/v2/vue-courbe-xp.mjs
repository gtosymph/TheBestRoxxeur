/**
 * La courbe du mode Monter, dans le volet de gauche.
 *
 * Elle repond a la seule question que le produit ne montre pas : ou passe le
 * change entre les degats et la sagesse. L'axe horizontal porte les degats,
 * le vertical la sagesse ; chaque point est le stuff le plus sage a ce niveau
 * de degats, et le point marque est celui qui fait monter le plus vite.
 *
 * Aucun curseur ici, contrairement au mode mixte : le score est un produit,
 * et un produit ne se regle pas. Ce qui se decide, c'est le stuff qu'on
 * porte — et cela se fait au clic, sur un point.
 */
import { el } from '../render.mjs';
import { lignesSurvie } from '../survie-panel.mjs';
import { dessinerCourbe, pointLePlusProche } from '../courbe-survie.mjs';
import { AXE_XP } from '../../src/solver/survie.mjs';
import {
  consequenceXp, palierXpRetenu, rangDuPalierXp, signatureXp,
} from './courbe-xp.mjs';

const nombre = (n) => Math.round(n).toLocaleString('fr-FR');

/** Ce qui est monte dans la page, pour ne pas le refaire sans raison. */
let monte = null;

/**
 * Dessine la courbe sagesse contre degats.
 *
 * @param {HTMLElement} racine
 * @param {object} liens
 * @param {any[]} liens.paliers Paliers rendus par la derniere recherche.
 * @param {{damage: number, sagesse: number}|null} liens.porte Build porte.
 * @param {(palier: any) => void} liens.onChoisir Pose le stuff d'un point.
 */
export function renderCourbeXp(racine, { paliers, porte, onChoisir }) {
  const lignes = lignesSurvie(paliers ?? [], porte, AXE_XP);
  const signature = signatureXp(lignes);

  if (!monte || monte.racine !== racine || monte.signature !== signature) {
    monte = construire(racine, lignes, signature, onChoisir);
  }
  monte.maj(lignes);
}

/** Monte le bloc une fois, et rend de quoi le mettre a jour. */
function construire(racine, lignes, signature, onChoisir) {
  if (lignes.length === 0) {
    racine.replaceChildren(el('p', { class: 'aide',
      text: 'Lancez une recherche : la courbe montrera ce que chaque point de '
        + 'dégât lâché vous rapporte en sagesse.' }));
    return { racine, signature, maj: () => {} };
  }

  /** Le palier pose au dernier clic, ou null. Il prime sur le point retenu. */
  let choisi = null;

  // Trois mesures au lieu de deux : le libelle passe SOUS le chiffre. Cote a
  // cote, « vitesse d'XP » se coupait en deux au milieu du mot.
  const consequence = el('div', { class: 'consequence trois' });
  const toile = el('canvas', { class: 'melange-courbe', height: '120' });

  racine.replaceChildren(consequence, toile,
    el('p', { class: 'aide',
      text: 'Chaque point est le stuff le plus sage à ce niveau de dégâts. '
        + 'Le point marqué fait monter le plus vite. Cliquez-en un pour le porter.' }));

  let traces = [];
  let survole = null;
  let vue = { courantes: lignes };

  /** Point sous la souris, dans le repere de la toile. */
  const sous = (ev) => {
    const cadre = toile.getBoundingClientRect();
    return pointLePlusProche(traces, ev.clientX - cadre.left, ev.clientY - cadre.top);
  };

  toile.addEventListener('mousemove', (ev) => {
    const point = sous(ev);
    const rang = point ? point.rang : null;
    if (rang === survole) return;
    survole = rang;
    toile.style.cursor = rang === null ? 'default' : 'pointer';
    redessiner();
  });

  toile.addEventListener('mouseleave', () => {
    if (survole === null) return;
    survole = null;
    redessiner();
  });

  toile.addEventListener('click', (ev) => {
    const point = sous(ev);
    if (!point) return;
    const ligne = vue.courantes[point.rang];
    // Le stuff porte figure dans la courbe : le reposer ne ferait rien, et il
    // ne porte pas toujours la liste de ses pieces.
    if (!ligne || ligne.porte || !Array.isArray(ligne.palier?.itemIds)) return;
    choisi = ligne.palier;
    onChoisir?.(ligne.palier);
  });

  /**
   * Le point que la courbe marque et que la bande annonce.
   * Trois reponses, dans cet ordre : le survol, le dernier clic, le produit.
   */
  const rangMontre = () => survole
    ?? rangDuPalierXp(vue.courantes, choisi)
    ?? palierXpRetenu(vue.courantes);

  function majConsequence() {
    const quoi = consequenceXp(vue.courantes, rangMontre());
    consequence.classList.toggle('survolee', survole !== null);
    consequence.replaceChildren(...(quoi ? [
      el('span', {}, el('b', { class: 'n', text: nombre(quoi.degats) }),
        el('em', { text: 'degats' })),
      el('span', {}, el('b', { class: 'n', text: nombre(quoi.sagesse) }),
        el('em', { text: 'sagesse' })),
      el('span', {}, el('b', { class: 'n', text: nombre(quoi.vitesse) }),
        el('em', { text: 'vitesse d\'XP' })),
    ] : []));
  }

  /** Le canvas n'a sa taille qu'une fois pose dans la page. */
  function redessiner() {
    majConsequence();
    requestAnimationFrame(() => {
      traces = dessinerCourbe(toile, {
        lignes: vue.courantes, axe: AXE_XP, retenu: rangMontre(), survole,
        libelles: { x: 'degats', y: 'sagesse' },
      });
    });
  }

  function maj(courantes = lignes) {
    vue = { courantes };
    redessiner();
  }

  return { racine, signature, maj };
}
