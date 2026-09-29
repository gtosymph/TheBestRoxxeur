/**
 * La fiche d'un sort ecrit par le joueur.
 *
 * Le catalogue ne couvre pas tout : un sort d'evenement, un effet d'allie, un
 * enchainement que le jeu ne decrit pas. La fiche laisse le joueur ecrire son
 * sort, avec autant de lignes de degats qu'il veut, chacune dans son element
 * et, s'il le faut, a un tour plus tard.
 *
 * La fiche garde un brouillon et ne touche l'etat qu'a l'enregistrement : un
 * sort a moitie ecrit ne doit pas faire bouger le score a chaque touche. La
 * verification vit dans src/data/sort-perso.mjs ; ici, on ne fait que la
 * montrer.
 */
import { el } from '../render.mjs';
import { piegerFocus } from '../focus-piege.mjs';
import { ELEMENTS, ajouterLigne, enleverLigne, modifierLigne } from '../../src/data/spell-lines.mjs';
import { MAX_LIGNES, verifierSortPerso } from '../../src/data/sort-perso.mjs';

/** Nom montre de chaque element. */
const NOMS_ELEMENTS = Object.freeze({
  neutre: 'Neutre', terre: 'Terre', feu: 'Feu', eau: 'Eau', air: 'Air',
});

/** Tours proposes pour une ligne : zero veut dire « ce tour-ci ». */
const TOURS = Object.freeze([0, 1, 2, 3, 4, 5]);

/** Les quatre bornes d'une ligne, dans l'ordre de la fiche du jeu. */
const BORNES_LIGNE = Object.freeze([
  ['min', 'Min'], ['max', 'Max'], ['critMin', 'Crit min'], ['critMax', 'Crit max'],
]);

let racine = null;
let libererFocus = null;

/** Ferme la fiche. */
export function fermerSortPerso() {
  if (!racine) return;
  racine.hidden = true;
  libererFocus?.();
  libererFocus = null;
}

/** Vrai quand la fiche est ouverte. */
export const sortPersoOuvert = () => Boolean(racine) && !racine.hidden;

/**
 * Ouvre la fiche d'un sort.
 *
 * @param {object} liens
 * @param {object} liens.sort Sort a modifier, ou brouillon d'un nouveau sort.
 * @param {boolean} liens.existe Vrai quand le sort est deja dans la liste.
 * @param {(sort: object) => void} liens.onEnregistrer
 * @param {(id: string) => void} liens.onSupprimer
 */
export function ouvrirSortPerso({ sort, existe, onEnregistrer, onSupprimer }) {
  if (!racine) {
    racine = el('div', { class: 'feuille-fond', hidden: true, onClick: (ev) => {
      if (ev.target === racine) fermerSortPerso();
    } });
    document.body.append(racine);
  }

  let brouillon = sort;
  const lignes = el('div', { class: 'perso-lignes' });
  const erreurs = el('div', { class: 'perso-erreurs', role: 'alert' });
  const ajout = el('button', { class: 'btn mini', type: 'button', text: '+ Ajouter une ligne',
    onClick: () => { brouillon = ajouterLigne(brouillon); dessinerLignes(); } });

  /** Change un champ du sort, sans redessiner : le curseur reste en place. */
  const poser = (champ) => (ev) => { brouillon = { ...brouillon, [champ]: ev.target.value }; };

  /** Change une borne ou l'element d'une ligne. */
  const poserLigne = (rang, champ) => (ev) => {
    brouillon = modifierLigne(brouillon, rang, champ, ev.target.value);
  };

  function dessinerLignes() {
    const seule = brouillon.lines.length <= 1;
    lignes.replaceChildren(
      el('div', { class: 'perso-ligne perso-entete', 'aria-hidden': 'true' },
        el('span', { text: 'Élément' }),
        ...BORNES_LIGNE.map(([, nom]) => el('span', { text: nom })),
        el('span', { text: 'Tour' }),
        el('span')),
      ...brouillon.lines.map((ligne, rang) => ligneDeLaFiche(ligne, rang, seule)),
    );
    ajout.disabled = brouillon.lines.length >= MAX_LIGNES;
  }

  function ligneDeLaFiche(ligne, rang, seule) {
    const numero = rang + 1;
    return el('div', { class: 'perso-ligne' },
      el('select', { 'aria-label': `Élément de la ligne ${numero}`, onChange: poserLigne(rang, 'element') },
        ...ELEMENTS.map((element) => el('option', {
          value: element, text: NOMS_ELEMENTS[element], selected: element === ligne.element,
        }))),
      ...BORNES_LIGNE.map(([champ, nom]) => el('input', {
        class: 'n', type: 'number', min: '0', step: '1', value: String(ligne[champ] ?? 0),
        'aria-label': `${nom} de la ligne ${numero}`, onInput: poserLigne(rang, champ),
      })),
      el('select', { 'aria-label': `Tour de la ligne ${numero}`, onChange: poserLigne(rang, 'differe') },
        ...TOURS.map((tours) => el('option', {
          value: String(tours), text: tours === 0 ? 'Ce tour' : `T+${tours}`,
          selected: tours === (ligne.differe ?? 0),
        }))),
      el('button', {
        class: 'btn fantome mini', type: 'button', text: '×', disabled: seule,
        title: seule ? 'Un sort garde au moins une ligne.' : `Enlever la ligne ${numero}`,
        'aria-label': `Enlever la ligne ${numero}`,
        onClick: () => { brouillon = enleverLigne(brouillon, rang); dessinerLignes(); },
      }));
  }

  function enregistrer(ev) {
    ev.preventDefault();
    const { sort: verifie, erreurs: liste } = verifierSortPerso(brouillon);
    if (!verifie) {
      erreurs.replaceChildren(...liste.map((texte) => el('p', { text: texte })));
      return;
    }
    onEnregistrer(verifie);
    fermerSortPerso();
  }

  const champ = (libelle, attributs) => el('label', { class: 'perso-champ' },
    el('span', { text: libelle }), el('input', attributs));

  racine.replaceChildren(el('form', {
    class: 'feuille large', role: 'dialog', 'aria-modal': 'true',
    'aria-label': existe ? 'Modifier le sort' : 'Créer un sort', onSubmit: enregistrer,
  },
    el('div', { class: 'feuille-tete' },
      el('h2', { text: existe ? 'Modifier le sort' : 'Créer un sort' }),
      el('div', { class: 'pousse' }),
      el('button', { class: 'btn fantome', type: 'button', text: 'Fermer', onClick: fermerSortPerso })),
    el('div', { class: 'feuille-corps' },
      el('p', { class: 'aide', text: 'Écrivez un sort que le catalogue ne connaît pas : un sort '
        + 'd\'événement, un effet d\'allié, ou un enchaînement à vous. Mettez les dégâts de base '
        + 'de la fiche du sort : l\'outil ajoute vos caractéristiques.' }),
      el('div', { class: 'perso-tete' },
        champ('Nom', { type: 'text', value: brouillon.name ?? '', maxlength: '40',
          onInput: poser('name'), required: true }),
        champ('PA', { class: 'n', type: 'number', min: '1', max: '12', value: String(brouillon.apCost),
          onInput: poser('apCost') }),
        champ('Lancers par tour', { class: 'n', type: 'number', min: '1', max: '10',
          value: String(brouillon.castsPerTurn), onInput: poser('castsPerTurn') }),
        champ('Critique (%)', { class: 'n', type: 'number', min: '0', max: '100',
          value: String(brouillon.baseCrit ?? 0), onInput: poser('baseCrit') })),
      el('h3', { class: 'titre-reglage', text: 'Lignes de dégâts' }),
      lignes,
      el('div', { class: 'perso-actions-lignes' }, ajout,
        el('span', { class: 'aide', text: `Jusqu'à ${MAX_LIGNES} lignes. « T+1 » touche au tour suivant.` })),
      erreurs,
      el('div', { class: 'perso-pied' },
        existe ? el('button', { class: 'btn fantome danger', type: 'button', text: 'Supprimer ce sort',
          onClick: () => { onSupprimer(brouillon.id); fermerSortPerso(); } }) : null,
        el('div', { class: 'pousse' }),
        el('button', { class: 'btn premier', type: 'submit', text: 'Enregistrer' }))),
  ));

  dessinerLignes();
  racine.hidden = false;
  libererFocus?.();
  libererFocus = piegerFocus(racine);
  racine.querySelector('.perso-champ input')?.focus();
}
