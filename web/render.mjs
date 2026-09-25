/**
 * Rendu des panneaux. Chaque fonction remplit un noeud a partir de l'etat.
 *
 * Les sorts, l'arme et le combo vivent dans `render-sorts.mjs` ; l'analyse,
 * les stuffs trouves et les panoplies dans `render-resultats.mjs`. Ce module
 * les rend aussi, pour que chaque ecran n'ait qu'une adresse a connaitre.
 */
import { SLOTS } from '../src/data/slots.mjs';
import { conditionValue } from '../src/solver/condition-value.mjs';
import { LIBELLE_CASE } from './layout.mjs';
import { iconeStat } from './icons.mjs';
import { cacherBulle, montrerBulle, suivreBulle } from './hover-card.mjs';
import {
  el, entier, fill, nombre, ton, vignette,
} from './render-outils.mjs';

export { el } from './render-outils.mjs';
export {
  ligneArme, renderArme, renderCombo, renderPuceSorts, renderSorts, resumeArme,
} from './render-sorts.mjs';
export { renderAnalyse, renderCandidats, renderPanoplies } from './render-resultats.mjs';

/** Nombre de cases montrees dans le catalogue. */
const MAX_CASES = 300;


/**
 * Remplit un panneau de paires libelle / valeur.
 * @param {HTMLElement} root
 * @param {readonly (readonly [string, string])[]} liste
 * @param {Record<string, number> | null} stats
 */
export function renderPaires(root, liste, stats, options = {}) {
  const { suivies = new Set(), onPick = null } = options;

  if (!stats) {
    fill(root, el('dt', { text: '—' }), el('dd', { class: 'nul', text: '—' }));
    return;
  }

  fill(root, liste.flatMap(([cle, libelle]) => {
    const valeur = stats[cle] ?? 0;
    const icone = iconeStat(cle);
    const suivie = suivies.has(cle);

    const nom = el('dt', {
      class: `${onPick ? 'cliquable' : ''} ${suivie ? 'suivie' : ''}`.trim(),
      title: onPick
        ? (suivie ? `${libelle} — déjà dans les conditions` : `${libelle} — cliquez pour en faire une condition`)
        : libelle,
      ...(onPick ? { role: 'button', tabindex: '0' } : {}),
      ...(onPick ? { onClick: () => onPick(cle) } : {}),
      ...(onPick ? { onKeydown: (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(cle); }
      } } : {}),
    },
      icone ? el('img', { src: icone, alt: '', decoding: 'async' }) : null,
      el('span', { text: libelle }));

    return [nom, el('dd', { class: ton(valeur), text: nombre(valeur) })];
  }));
}

/** Types de la case monture, proposes en onglets separes. */
const TYPES_MONTURE = Object.freeze(['Dragodinde', 'Volkorne', 'Muldo', 'Familier', 'Montilier']);

/** Types de la case artefact, proposes en onglets separes. */
const TYPES_ARTEFACT = Object.freeze([
  { type: 'Dofus', label: 'Dofus' },
  { type: 'Trophée', label: 'Trophées' },
  { type: 'Prysmaradite', label: 'Prysmaradites' },
]);

/**
 * Remplit les onglets de filtre du catalogue.
 * Les cases monture et artefact s'ouvrent en plusieurs onglets, un par type.
 */
export function renderOnglets(root, actif, onPick, typeActif = null) {
  const entrees = [{ key: null, type: null, label: 'Tous' }];
  for (const slot of SLOTS) {
    if (slot.key === 'monture') {
      for (const type of TYPES_MONTURE) entrees.push({ key: slot.key, type, label: type });
    } else if (slot.key === 'artefact') {
      for (const e of TYPES_ARTEFACT) entrees.push({ key: slot.key, type: e.type, label: e.label });
    } else {
      entrees.push({ key: slot.key, type: null, label: slot.label });
    }
  }

  fill(root, entrees.map((e) => el('button', {
    type: 'button',
    'aria-pressed': String(actif === e.key && (typeActif ?? null) === e.type),
    text: e.label,
    onClick: () => onPick(e.key, e.type),
  })));
}

/**
 * Chargement des icones de la grille.
 *
 * Ni le chargement paresseux natif ni IntersectionObserver ne se declenchent
 * dans ce cadre defilant. Le calcul de position ci-dessous ne depend d'aucun
 * de ces mecanismes : il compare simplement les rectangles.
 */
const MARGE_CHARGEMENT = 300;

/** Charge les icones proches du cadre visible. */
function chargerVisibles(grille) {
  const cadre = grille.getBoundingClientRect();
  const haut = cadre.top - MARGE_CHARGEMENT;
  const bas = cadre.bottom + MARGE_CHARGEMENT;

  for (const img of grille.querySelectorAll('img[data-src]')) {
    const r = img.getBoundingClientRect();
    if (r.bottom < haut || r.top > bas) continue;
    img.src = img.dataset.src;
    delete img.dataset.src;
  }
}

/** Verification periodique, tant qu'il reste des icones a charger. */
let veille = null;

/**
 * Branche le chargement au defilement, avec une veille de securite.
 *
 * Le defilement programme ne declenche pas toujours l'evenement "scroll".
 * La veille comble ce manque : elle compare les positions a intervalle court
 * et s'arrete des que toutes les icones sont chargees.
 */
function suivreDefilement(grille) {
  let planifie = false;
  const relancer = () => {
    if (planifie) return;
    planifie = true;
    requestAnimationFrame(() => { planifie = false; chargerVisibles(grille); });
  };

  if (!grille.dataset.suivi) {
    grille.dataset.suivi = '1';
    grille.addEventListener('scroll', relancer, { passive: true });
    window.addEventListener('scroll', relancer, { passive: true });
    window.addEventListener('resize', relancer, { passive: true });
  }

  clearInterval(veille);
  veille = setInterval(() => {
    if (!grille.isConnected || grille.querySelector('img[data-src]') === null) {
      clearInterval(veille);
      veille = null;
      return;
    }
    chargerVisibles(grille);
  }, 400);
}


/** Remplit la grille du catalogue. */
export function renderCatalogue(root, compteur, items, onPick, bannis = new Set(), possedees = new Set()) {
  const montres = items.slice(0, MAX_CASES);
  fill(root, montres.map((item) => {
    const marques = [
      bannis.has(item.id) ? 'bannie' : '',
      possedees.has(item.id) ? 'possedee' : '',
    ].filter(Boolean).join(' ');
    const noeud = vignette(item, marques);
    if (bannis.has(item.id)) noeud.title += '\nBannie : le solveur ne la propose plus.';
    // Le titre natif laisserait sa place : l'infobulle le remplace au survol.
    noeud.removeAttribute('title');
    noeud.addEventListener('click', () => { cacherBulle(); onPick(item); });
    noeud.addEventListener('mouseenter', (ev) => montrerBulle(item, ev.clientX, ev.clientY,
      { ancre: noeud }));
    noeud.addEventListener('mousemove', (ev) => suivreBulle(ev.clientX, ev.clientY));
    noeud.addEventListener('mouseleave', cacherBulle);
    return noeud;
  }));

  suivreDefilement(root);
  // Deux passes : la seconde rattrape la mise en page qui suit l'insertion.
  chargerVisibles(root);
  requestAnimationFrame(() => chargerVisibles(root));
  compteur.textContent = items.length > MAX_CASES
    ? `${nombre(items.length)} pièces — ${MAX_CASES} montrées`
    : `${nombre(items.length)} piece${items.length > 1 ? 's' : ''}`;
}

/**
 * Remplit la liste des pieces bannies.
 * @param {HTMLElement} root
 * Le meme rendu sert aux pieces que le joueur possede : dans les deux cas,
 * une liste de pieces dont un clic retire l'etiquette.
 *
 * @param {any[]} items Pieces bannies, dans l'ordre du catalogue.
 * @param {(item: any) => void} onUnban
 * @param {{vide?: string, aide?: string}} [textes] Mots propres a la liste.
 */
export function renderBannis(root, items, onUnban, textes = {}) {
  const {
    vide = 'Aucune pièce bannie. Ouvrez la fiche d\'une pièce pour la bannir.',
    aide = 'cliquez pour autoriser de nouveau',
  } = textes;

  if (items.length === 0) {
    fill(root, el('p', { class: 'note', text: vide }));
    return;
  }

  fill(root, items.map((item) => el('button', {
    class: 'puce-bannie', type: 'button',
    title: `${item.fr} — ${aide}`,
    onClick: () => onUnban(item),
  },
    item.img ? el('img', { src: item.img, alt: '', decoding: 'async' }) : null,
    el('span', { text: item.fr }),
    el('span', { class: 'croix', text: '×' }),
  )));
}

/**
 * Remplit une colonne de cases d'equipement.
 * @param {HTMLElement} root
 * @param {readonly string[]} cles
 * @param {Map<string, any>} equipped
 * @param {Set<string>} posees Cases choisies a la main.
 * @param {(cle: string, item: any) => void} onPick Ouvre la fiche de la piece.
 */
export function renderCases(root, cles, equipped, posees, onPick, verrous = new Set(), stats = null) {
  fill(root, cles.map((cle) => {
    const item = equipped.get(cle);
    const libelle = LIBELLE_CASE[cle] ?? cle;

    if (!item) {
      return el('button', { class: 'case-slot vide', type: 'button', title: `${libelle} — libre`, disabled: true },
        el('span', { class: 'note', text: '' }));
    }

    const marque = verrous.has(item.id) ? 'verrou' : (posees.has(cle) ? 'pose' : 'solveur');
    return el('button', {
      class: `case-slot ${marque}`, type: 'button',
      onClick: () => onPick(cle, item),
      // Le survol montre l'infobulle ; le clic ouvre la fiche complete.
      // Les stats du build permettent le calcul des degats de l'arme portee.
      onMouseenter: (ev) => montrerBulle(item, ev.clientX, ev.clientY,
        { stats, ancre: ev.currentTarget }),
      onMousemove: (ev) => suivreBulle(ev.clientX, ev.clientY),
      onMouseleave: cacherBulle,
      onFocus: cacherBulle,
    }, item.img
      ? el('img', { src: item.img, alt: item.fr, decoding: 'async' })
      : el('span', { text: item.fr.slice(0, 2) }));
  }));
}

/** Remplit le tableau des conditions. */
export function renderConditions(root, conditions, stats, libelles, options) {
  const { onChange, onRemove, degats = 0 } = options;
  fill(root, conditions.map((condition, index) => {
    // Les degats ne vivent pas dans les statistiques : une condition qui
    // porte sur eux lirait zero sans cette valeur, et paraitrait manquee
    // alors que le build frappe assez fort.
    const valeur = stats ? conditionValue(condition.stat, stats, degats) : null;
    const manque = valeur == null ? null : Math.max(0, condition.target - valeur);
    const tenue = manque === 0;
    const icone = iconeStat(condition.stat);

    // La barre montre d'un coup d'oeil la part de l'objectif deja atteinte.
    const part = valeur == null || condition.target <= 0
      ? 1
      : Math.min(1, Math.max(0, valeur / condition.target));

    // Le place-tenant reste court : dans une colonne etroite de telephone,
    // « Maximum » se coupait en plein mot. L'infobulle porte le nom entier.
    const champ = (cle, titre, court = titre) => el('input', {
      type: 'number', value: String(condition[cle] ?? ''), title: titre, placeholder: court,
      onChange: (ev) => onChange(index, cle, Number(ev.target.value)),
    });

    return el('tr', { class: valeur == null ? '' : (tenue ? 'tenue' : 'manquee') },
      el('td', {},
        el('div', { class: 'nom-stat', title: libelles[condition.stat] ?? condition.stat },
          icone ? el('img', { src: icone, alt: '', decoding: 'async' }) : null,
          el('span', { text: libelles[condition.stat] ?? condition.stat })),
        el('div', { class: `barre-ecart ${tenue ? '' : 'manque'}`.trim() },
          el('span', { style: `width:${Math.round(part * 100)}%` }))),
      // Chaque cellule porte le nom de sa colonne. En large il ne sert a
      // rien — l'en-tete du tableau le dit. Sur telephone, ou la ligne
      // devient une carte, c'est LUI qui nomme le chiffre : sans lui on lit
      // « 12 · 250 · 12 » sans savoir lequel est l'objectif.
      el('td', { 'data-libelle': 'Objectif' }, champ('target', 'Objectif')),
      el('td', { 'data-libelle': 'Poids' }, champ('weight', 'Poids')),
      el('td', { 'data-libelle': 'Max' }, champ('max', 'Maximum', 'Max')),
      el('td', { 'data-libelle': 'Absolu' }, el('button', {
        class: 'mini', type: 'button', 'aria-pressed': String(Boolean(condition.absolute)),
        title: 'Maximum absolu : le solveur ne le franchit pas', text: 'A',
        onClick: () => onChange(index, 'absolute', !condition.absolute),
      })),
      el('td', { class: 'etat', 'data-libelle': 'Atteint' }, valeur == null
        ? el('span', { class: 'nul', text: '—' })
        : el('span', {
            style: `color:${tenue ? 'var(--positif)' : 'var(--alerte)'}`,
            text: tenue ? nombre(valeur) : `${nombre(valeur)} −${nombre(manque)}`,
          })),
      el('td', {}, el('button', { class: 'mini', type: 'button', text: '×',
        title: 'Enlever', onClick: () => onRemove(index) })),
    );
  }));
}

/**
 * Remplit la liste des options, rangees par groupe.
 *
 * `groupes` donne l'ordre et les titres ; une option sans groupe connu se
 * range a la fin, sous aucun titre, plutot que de disparaitre.
 *
 * @param {HTMLElement} root
 * @param {any[]} options
 * @param {(cle: string, valeur: any) => void} onToggle
 * @param {{cle: string, titre: string}[]} [groupes]
 */
export function renderOptions(root, options, onToggle, groupes = []) {
  const champ = ({ cle, libelle, actif, aide, type, min, max, choix, inactif }) => {
    // Une option a plusieurs reponses montre une liste : trois etats ne
    // tiennent pas dans une case a cocher.
    if (type === 'liste') {
      return el('label', { class: `option liste ${inactif ? 'off' : ''}`.trim(), title: aide ?? '' },
        el('span', { text: libelle }),
        el('select', {
          ...(inactif ? { disabled: true } : {}),
          onChange: (ev) => onToggle(cle, ev.target.value),
        }, (choix ?? []).map((option) => el('option', {
          value: option.valeur,
          text: option.nom,
          ...(String(actif ?? '') === String(option.valeur) ? { selected: true } : {}),
        }))),
      );
    }

    // Une option numerique montre un champ au lieu d'une case a cocher.
    if (type === 'nombre') {
      return el('label', { class: `option nombre ${inactif ? 'off' : ''}`.trim(), title: aide ?? '' },
        el('span', { text: libelle }),
        el('input', { type: 'number', min: min ?? 0, max: max ?? 99, value: Number(actif) || 0,
          ...(inactif ? { disabled: true } : {}),
          onChange: (ev) => onToggle(cle, Math.max(min ?? 0, Number(ev.target.value) || 0)) }),
      );
    }

    return el('label', { class: 'option', title: aide ?? '' },
      el('input', { type: 'checkbox', ...(actif ? { checked: true } : {}),
        onChange: (ev) => onToggle(cle, ev.target.checked) }),
      el('span', { text: libelle }),
    );
  };

  // Sans groupe declare, le panneau garde la liste a plat : l'appelant qui
  // ne connait pas les groupes ne perd rien.
  if (groupes.length === 0) {
    fill(root, options.map(champ));
    return;
  }

  const connus = new Set(groupes.map((g) => g.cle));
  const orphelines = options.filter((o) => !connus.has(o.groupe));

  fill(root, [
    ...groupes.map((groupe) => {
      const dedans = options.filter((o) => o.groupe === groupe.cle);
      if (dedans.length === 0) return null;
      return el('div', { class: 'groupe-options' },
        el('h3', { class: 'titre-groupe', text: groupe.titre }),
        el('div', { class: 'options-groupe' }, dedans.map(champ)));
    }).filter(Boolean),
    ...(orphelines.length > 0
      ? [el('div', { class: 'groupe-options' },
          el('div', { class: 'options-groupe' }, orphelines.map(champ)))]
      : []),
  ]);
}
