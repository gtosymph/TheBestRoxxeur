/**
 * « Ce que j'ai » et les minimums, dans le volet de gauche.
 *
 * Trois lignes ouvrent chacune une liste de la palette : le stuff fige, la
 * banque et les pieces interdites. Dessous, chaque minimum se lit face a la
 * valeur que le moteur lui compare, et se regle sans ouvrir la feuille.
 */
import { el } from '../render.mjs';
import { buildCourant, scoreAffiche } from '../objectif.mjs';
import { iconeStat } from '../icons.mjs';
import { STAT_LABELS } from '../../src/data/stats.mjs';
import { conditionValue } from '../../src/solver/condition-value.mjs';

import { ouvrirMinimums } from './vue-minimums.mjs';
import { avecCible } from './minimums.mjs';
import { nombre } from './nombres.mjs';

/**
 * Le raccourci de la palette, ecrit comme la machine le dit.
 *
 * « ⌘K » sur un Mac, « Ctrl K » ailleurs : montrer le mauvais signe apprend un
 * geste qui ne marche pas.
 */
function raccourciPalette() {
  const surMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
  return surMac ? '⌘K' : 'Ctrl K';
}

/** Un bouton ne s'imbrique pas dans un bouton : le geste de cote vit a COTE de la ligne. */
function ligne(texte, valeur, actions = {}) {
  const corps = el(actions.onClick ? 'button' : 'div', {
    class: 'avoir-ligne', ...(actions.onClick ? { type: 'button', onClick: actions.onClick } : {}),
    ...(actions.title ? { title: actions.title } : {}),
  },
    el('span', { text: texte }), el('span', {}, el('b', { text: String(valeur) })));
  return actions.action ? el('div', { class: 'avoir-rangee' }, corps, actions.action) : corps;
}

/**
 * @param {object} liens
 * @param {(id: string) => HTMLElement} liens.$
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 * @param {() => any} liens.lireCatalogue
 * @param {any} liens.gestesReference
 * @param {(liste: 'stuff'|'banque'|'interdits') => void} liens.ouvrirListe
 * @param {(stat: string) => void} liens.enleverMinimum
 */
export function creerRenduAvoir({
  $, lireEtat, setEtat, message, lireCatalogue, gestesReference, ouvrirListe, enleverMinimum,
}) {
  function renderListes() {
    const etat = lireEtat();
    // Voir sa liste et la defaire sont deux gestes, pas un. Le clic OUVRE la
    // liste ; figer et oublier passent par un bouton a part. Un seul clic mal
    // place effacait la reference, sans rien pour revenir en arriere.
    const aUneReference = Boolean(etat.reference);
    $('avoir').replaceChildren(
      ligne('Mon stuff actuel', aUneReference ? etat.reference.itemIds.length : '—', {
        onClick: aUneReference ? () => ouvrirListe('stuff') : null,
        title: aUneReference
          ? 'Voir les pièces de ce stuff.'
          : 'Aucun stuff figé.',
        action: el('button', {
          class: 'btn mini fantome', type: 'button',
          text: aUneReference ? 'Oublier' : 'Figer',
          title: aUneReference
            ? 'Oublier ce stuff : le solveur cherchera sans compter les achats.'
            : 'Figer le stuff porté comme celui que vous avez en jeu. Les pièces '
              + 'que le solveur propose se comptent alors en achats.',
          onClick: () => {
            if (aUneReference) gestesReference.oublierReference();
            else gestesReference.figerReference();
          },
        }),
      }),
      ligne('Pièces en banque', etat.possedees.size,
        { onClick: () => ouvrirListe('banque'),
          title: 'Voir les pièces que vous avez déjà.' }),
      ligne('Pièces interdites', etat.bannis.size,
        { onClick: () => ouvrirListe('interdits'),
          title: 'Voir les pièces que le solveur ne proposera plus.' }));

    $('ouvrir-palette').replaceChildren('Toutes les pièces',
      el('span', { class: 'raccourci', text: raccourciPalette() }));
  }

  function renderMinimums(stats, degats) {
    const etat = lireEtat();
    // Un minimum se lit a cote de la valeur que le MOTEUR lui compare, pas de
    // la statistique qui porte le meme nom. Une condition « Vitalite » porte sur
    // les points de vie : montrer la caracteristique donnait un minimum tenu et
    // pourtant rouge, et personne ne pouvait comprendre pourquoi.
    $('compte-limites').textContent = String(etat.conditions.length);
    $('regler-minimums').onclick = () => ouvrirMinimums({
      lireEtat, setEtat, message,
      lireMesures: () => {
        const courant = lireEtat();
        const b = buildCourant(courant, lireCatalogue());
        const bl = b ? scoreAffiche(courant, b.stats) : null;
        return { stats: b?.stats ?? null, degats: Number(bl?.damage) || 0 };
      },
    });
    // Le champ garde le focus au travers du redessin. Sans cela, la fleche du
    // champ posait un etat, l'application se redessinait, et le champ que le
    // doigt tenait encore disparaissait au premier clic.
    const tenait = document.activeElement?.dataset?.minimum ?? null;

    $('limites').replaceChildren(...etat.conditions.map((c) => {
      const valeur = conditionValue(c.stat, stats, degats ?? 0);
      const tenu = valeur >= c.target;
      const icone = iconeStat(c.stat);
      const nom = STAT_LABELS[c.stat] ?? c.stat;
      return el('div', { class: `limite ${tenu ? '' : 'defaut'}`.trim() },
        el('i', { class: `etat ${tenu ? 'tenue' : 'defaut'}` }),
        icone
          ? el('img', { class: 'limite-icone', src: icone, alt: '', decoding: 'async' })
          : el('span', { class: 'limite-icone' }),
        el('span', { class: 'limite-nom', text: nom }),
        // La valeur atteinte se lit, l'objectif se REGLE : passer de cinq a six
        // PM demandait d'ouvrir une feuille, d'y trouver la ligne et de la
        // refermer, pour un seul chiffre.
        el('b', { class: 'n', text: nombre(valeur) }),
        el('span', { class: 'limite-barre', text: '/' }),
        el('input', {
          class: 'limite-cible n', type: 'number', min: '0', step: '1',
          value: String(c.target), 'data-minimum': c.stat,
          'aria-label': `Minimum de ${nom.toLowerCase()}`,
          title: `Valeur à tenir. Le reste du réglage est dans « Régler mes minimums… ».`,
          onChange: (ev) => setEtat({
            conditions: avecCible(lireEtat().conditions, c.stat, ev.target.value),
          }),
        }),
        el('button', {
          class: 'oter', type: 'button', text: '×',
          title: `Ne plus exiger de ${nom.toLowerCase()}`,
          onClick: () => enleverMinimum(c.stat),
        }));
    }));

    if (tenait) {
      const champ = $('limites').querySelector(`[data-minimum="${CSS.escape(tenait)}"]`);
      champ?.focus();
      champ?.select?.();
    }
  }

  function renderAvoir(stats, degats) {
    renderListes();
    renderMinimums(stats, degats);
  }

  return { renderAvoir };
}
