/**
 * La palette de pieces.
 *
 * Chercher une piece est une tache ponctuelle, pas une reference constante :
 * cela ne merite pas un quart de l'ecran en permanence. L'ancien ecran y
 * consacrait une colonne entiere plus deux blocs — « pieces bannies » et
 * « pieces possedees » — qui ne servaient qu'a defaire ce qu'on avait fait
 * dans la colonne.
 *
 * Tout cela tient dans une palette que `⌘K` ouvre et que `Echap` ferme. Les
 * trois reglages par piece — interdire, toujours garder, je l'ai deja — se
 * prennent sur la fiche de la piece, la ou on la regarde.
 *
 * La palette se construit UNE FOIS par ouverture ; seule la grille se
 * redessine ensuite. Tout reconstruire a chaque frappe replacerait le curseur
 * a la fin du champ, et corriger une lettre au milieu d'un mot deviendrait
 * impossible.
 *
 * Le filtrage n'est pas refait ici : `itemsFiltres` decide, la palette montre.
 */
import { el, renderCatalogue, renderOnglets } from '../render.mjs';
import { itemsFiltres } from '../objectif.mjs';
import { piegerFocus } from '../focus-piege.mjs';
import { STATS } from '../../src/data/stats.mjs';
import { aideAvoir, basculesAvoir, suivanteAvoir } from './avoir.mjs';

let racine = null;
let libererFocus = null;
/**
 * Releve le filtre de liste a la fermeture.
 *
 * Sans cela, rouvrir la palette par le raccourci montrerait encore la banque,
 * sans que rien n'explique pourquoi la moitie du catalogue a disparu.
 */
let oublierListe = null;
/** Redessine la grille ouverte, sans toucher aux champs de saisie. */
let redessiner = null;

/** Redessine la palette si elle est ouverte. */
export function rafraichirPalette() {
  if (paletteOuverte()) redessiner?.();
}

/** Vrai quand la palette est ouverte. */
export const paletteOuverte = () => Boolean(racine) && !racine.hidden;

/** Ferme la palette. */
export function fermerPalette() {
  if (!racine) return;
  oublierListe?.();
  oublierListe = null;
  racine.hidden = true;
  libererFocus?.();
  libererFocus = null;
}

/**
 * Bascule la palette : la meme touche l'ouvre et la referme.
 *
 * `avoir` demande une des trois listes du joueur. Ouvrir la palette deja
 * filtree est le seul chemin qui repond a « lesquelles ? » en un clic. Quand
 * la palette montre deja cette liste, le meme geste la referme.
 *
 * @param {object} liens
 * @param {string|null} [avoir]
 */
export function basculerPalette(liens, avoir = null) {
  const deja = liens.lireEtat().filtreAvoir ?? null;
  if (paletteOuverte() && deja === avoir) fermerPalette();
  else ouvrirPalette(liens, avoir);
}

/**
 * Ouvre la palette.
 *
 * @param {object} liens
 * @param {() => any} liens.lireEtat
 * @param {() => any} liens.lireCatalogue
 * @param {(patch: object) => void} liens.setEtat
 * @param {(item: any) => void} liens.onPiece Ce qu'un clic sur une piece fait.
 * @param {string|null} [avoir] Liste du joueur a montrer d'entree.
 */
export function ouvrirPalette({ lireEtat, lireCatalogue, setEtat, onPiece }, avoir = null) {
  if (!racine) {
    racine = el('div', { class: 'palette-fond', hidden: true, onClick: (ev) => {
      if (ev.target === racine) fermerPalette();
    } });
    document.body.append(racine);
  }

  setEtat({ filtreAvoir: avoir });
  oublierListe = () => setEtat({ filtreAvoir: null });
  const depart = lireEtat();
  const grille = el('div', { class: 'palette-grille' });
  const compte = el('p', { class: 'aide' });
  const onglets = el('div', { class: 'palette-onglets' });
  const listes = el('div', { class: 'palette-avoir' });
  // Le pied dit ce qu'un clic fait. Il change avec la liste montree : dans
  // une liste, le clic OUVRE la piece au lieu de la poser.
  const aide = el('span', { class: 'aide' });

  /** Redessine la grille et les onglets, sans toucher aux champs de saisie. */
  function rafraichir() {
    const etat = lireEtat();
    renderOnglets(onglets, etat.filtre,
      (cle, type) => { setEtat({ filtre: cle, filtreType: type }); rafraichir(); },
      etat.filtreType);
    const montres = itemsFiltres(etat, lireCatalogue());
    renderCatalogue(grille, compte, montres, onPiece, etat.bannis, etat.possedees);
    aide.textContent = aideAvoir(etat.filtreAvoir ?? null, montres.length);
    listes.replaceChildren(...basculesAvoir(etat).map((vue) => el('button', {
      class: 'btn mini fantome', type: 'button', title: vue.titre,
      'aria-pressed': String(vue.actif),
      ...(vue.possible ? {} : { disabled: true }),
      onClick: () => {
        setEtat({ filtreAvoir: suivanteAvoir(lireEtat().filtreAvoir ?? null, vue.cle) });
        rafraichir();
      },
    }, vue.libelle, el('span', { class: 'compte n', text: String(vue.compte) }))));
  }

  const champ = el('input', {
    type: 'search', id: 'palette-recherche', placeholder: 'Chercher une pièce…',
    value: depart.recherche, autocomplete: 'off',
    onInput: (ev) => { setEtat({ recherche: ev.target.value }); rafraichir(); },
  });

  const poserFiltreStat = (patch) => {
    setEtat({ filtreStat: { ...lireEtat().filtreStat, ...patch } });
    rafraichir();
  };

  const { stat, op, valeur } = depart.filtreStat;
  const filtres = el('div', { class: 'palette-filtres' },
    el('select', { onChange: (ev) => poserFiltreStat({ stat: ev.target.value }) },
      el('option', { value: '', text: 'statistique…' }),
      ...STATS.map((s) => el('option', {
        value: s.key, ...(s.key === stat ? { selected: true } : {}), text: s.fr,
      }))),
    el('select', { onChange: (ev) => poserFiltreStat({ op: ev.target.value }) },
      ...[['>=', '≥'], ['<=', '≤']].map(([v, signe]) => el('option', {
        value: v, ...(v === op ? { selected: true } : {}), text: signe,
      }))),
    el('input', {
      type: 'number', class: 'n', value: String(valeur),
      onChange: (ev) => poserFiltreStat({ valeur: Number(ev.target.value) || 0 }),
    }),
    el('label', { class: 'option',
      title: 'Ne garder que les trophées dont la condition demande moins de trois bonus' },
      el('input', {
        type: 'checkbox', ...(depart.filtrePk ? { checked: true } : {}),
        onChange: (ev) => { setEtat({ filtrePk: ev.target.checked }); rafraichir(); },
      }),
      ' Bonus de panoplie < 3'));

  racine.replaceChildren(el('div', {
    class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Toutes les pièces',
  },
    el('div', { class: 'palette-tete' }, champ,
      el('button', { class: 'btn fantome', type: 'button', text: 'Fermer',
        onClick: fermerPalette })),
    onglets,
    listes,
    filtres,
    grille,
    el('div', { class: 'palette-pied' }, compte, aide),
  ));

  redessiner = rafraichir;
  rafraichir();
  racine.hidden = false;
  libererFocus?.();
  libererFocus = piegerFocus(racine);
  champ.focus();
  champ.setSelectionRange(champ.value.length, champ.value.length);

  return { rafraichir };
}
