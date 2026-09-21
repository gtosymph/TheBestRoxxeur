/**
 * La feuille du journal des versions.
 *
 * La pastille de version disait un numero et rien d'autre. Un joueur qui
 * revient apres trois jours voit « v1.8.0 » sans savoir ce que ces trois
 * jours ont apporte ; un joueur qui signale un defaut deja corrige ne peut
 * pas le savoir non plus.
 *
 * La feuille montre tout depuis la premiere version, la plus recente en
 * haut. Elle ne demande rien et ne garde rien : elle se lit et se ferme.
 */
import { el } from '../render.mjs';
import { piegerFocus } from '../focus-piege.mjs';
import { dateLue, JOURNAL } from './journal.mjs';
import { VERSION } from '../version.mjs';

let racine = null;
let libererFocus = null;

/** Ferme la feuille. */
export function fermerJournal() {
  if (!racine) return;
  racine.remove();
  racine = null;
  libererFocus?.();
  libererFocus = null;
}

/** Vrai quand la feuille est ouverte. */
export const journalOuvert = () => racine !== null;

/** Une version, avec sa date et ce qu'elle a apporte. */
function bloc(entree) {
  const courante = entree.version === VERSION;
  return el('section', { class: 'journal-version' },
    el('div', { class: 'journal-tete' },
      el('b', { class: 'n', text: `v${entree.version}` }),
      courante ? el('span', { class: 'journal-ici', text: 'celle que vous lisez' }) : null,
      el('div', { class: 'pousse' }),
      el('time', { class: 'journal-date', datetime: entree.date, text: dateLue(entree.date) })),
    el('p', { class: 'journal-titre', text: entree.titre }),
    el('ul', { class: 'journal-points' },
      ...entree.points.map((point) => el('li', { text: point }))));
}

/** Ouvre la feuille du journal. */
export function ouvrirJournal() {
  fermerJournal();

  const fermer = el('button', { class: 'btn fantome', type: 'button', text: 'Fermer',
    onClick: fermerJournal });

  racine = el('div', { class: 'feuille-fond', onClick: (ev) => {
    if (ev.target === racine) fermerJournal();
  } },
    el('div', { class: 'feuille journal', role: 'dialog', 'aria-modal': 'true',
      'aria-label': 'Ce qui a changé' },
      el('div', { class: 'feuille-tete' },
        el('h2', { text: 'Ce qui a changé' }),
        el('div', { class: 'pousse' }),
        fermer),
      el('div', { class: 'feuille-corps' },
        el('p', { class: 'aide',
          text: 'Chaque version depuis la première, la plus récente en haut.' }),
        ...JOURNAL.map(bloc))));

  document.body.append(racine);
  libererFocus = piegerFocus(racine);
  fermer.focus();
}
