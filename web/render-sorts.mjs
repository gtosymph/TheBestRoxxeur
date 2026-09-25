/**
 * Rendu des sorts, de l'arme et du combo.
 */
import { COULEUR_ELEMENT, iconeElement } from './icons.mjs';
import { porteeMax } from '../src/solver/genome.mjs';
import { el, entier, fill, nombre } from './render-outils.mjs';

/**
 * Remplit la grille des sorts retenus, sous forme de pastilles.
 * @param {HTMLElement} root
 * @param {any[]} sorts
 * @param {(index: number) => void} onRemove
 */
export function renderPuceSorts(root, sorts, onRemove) {
  fill(root, sorts.map((sort, index) => el('button', {
    class: 'puce-sort', type: 'button', title: `${sort.name} — cliquez pour enlever`,
    onClick: () => onRemove(index),
  },
    sort.icon ? el('img', { src: sort.icon, alt: '', decoding: 'async' }) : null,
    el('span', { text: sort.name }),
    el('span', { class: 'pa', text: `${sort.apCost} PA` }),
  )));
}

/**
 * Zone de detail d'un sort : plages, moyennes, taux critique.
 * @param {any} detail Resultat de computeSpellDetail.
 */
function detailSort(detail) {
  const taux = Math.round((detail.critRate ?? 0) * 100);
  const plage = (a, b) => (a === b ? nombre(a) : `${nombre(a)} – ${nombre(b)}`);

  return el('div', { class: 'sort-detail' },
    el('div', { class: 'sort-plages' },
      el('span', { class: 'cle', text: 'Normal' }),
      el('span', { class: 'val', text: plage(detail.normalMin, detail.normalMax) }),
      el('span', { class: 'cle crit', text: `Critique ${taux} %` }),
      el('span', { class: 'val crit', text: plage(detail.critMin, detail.critMax) }),
    ),
    // Plusieurs lignes : chacune montre son apport, element par element.
    (detail.parLigne?.length ?? 0) > 1
      ? el('div', { class: 'lignes-arme', title: 'Apport de chaque ligne, hors critique' },
          detail.parLigne.map((ligne) => ligneArme(ligne, plage(ligne.normalMin, ligne.normalMax))))
      : null,
    el('div', { class: 'sort-moyennes' },
      el('span', { title: 'Moyenne par coup, taux critique compris' },
        el('b', { text: entier(detail.average) }), ' par coup'),
      detail.perAp
        ? el('span', { title: 'Moyenne par point d\'action' },
            el('b', { text: entier(detail.perAp) }), ' par PA')
        : null,
      detail.comptes > 1
        ? el('span', { title: `${detail.comptes} lancer(s) comptés dans le score.\n`
            + `Le tour en permet ${detail.casts}.` },
            el('b', { text: entier(detail.total) }), ` au total (×${detail.comptes})`)
        : null,
    ),
  );
}

/**
 * Pastille d'une ligne de degats d'arme, avec l'icone de son element.
 * @param {{element: string, steal?: boolean}} ligne
 * @param {string} texte
 */
/**
 * Resume le cout et la cadence d'une arme, pour un titre ou une infobulle.
 *
 * Une arme ne se juge pas a ses seuls degats : ce qu'elle coute en PA, la
 * distance a laquelle elle atteint et le nombre de fois qu'elle frappe dans le
 * tour decident de sa place dans un build. Ces chiffres se lisent donc partout
 * ou l'arme se montre.
 *
 * @param {any} item Arme du catalogue.
 * @returns {string} Resume vide quand l'arme ne declare aucun chiffre.
 */
export function resumeArme(item) {
  const parties = [];

  const pa = Number(item?.apCost);
  if (Number.isFinite(pa) && pa > 0) parties.push(`${pa} PA`);

  // La portee dit d'un coup d'oeil si l'arme se joue au contact ou de loin.
  const portee = porteeMax(item);
  if (Number.isFinite(portee) && portee > 0) {
    parties.push(`portee ${portee} case${portee > 1 ? 's' : ''}`);
  }

  const lancers = Number(item?.usesPerTurn);
  if (Number.isFinite(lancers) && lancers > 0) {
    parties.push(`${lancers} lancer${lancers > 1 ? 's' : ''} par tour`);
  }

  const crit = Number(item?.critProbability);
  if (Number.isFinite(crit) && crit > 0) {
    parties.push(`${crit} % critique (+${item.critBonus ?? 0})`);
  }

  return parties.join(' · ');
}

export function ligneArme(ligne, texte) {
  const icone = iconeElement(ligne.element);
  return el('span', {
    class: 'ligne-arme',
    style: `--teinte:${COULEUR_ELEMENT[ligne.element] ?? '#8d97a9'}`,
    title: `${ligne.element}${ligne.steal ? ' — vol de vie' : ''}`,
  },
    icone ? el('img', { src: icone, alt: ligne.element, decoding: 'async' }) : null,
    el('span', { text: `${texte}${ligne.steal ? ' (vol)' : ''}` }));
}

/**
 * Carte de l'attaque de l'arme equipee, comptee dans les degats totaux.
 * @param {HTMLElement} root
 * @param {any|null} attaque Sort equivalent de l'arme, ou null.
 * @param {any|null} detail Resultat de computeSpellDetail.
 */
export function renderArme(root, attaque, detail) {
  if (!attaque) {
    fill(root);
    return;
  }

  fill(root, el('div', { class: 'sort arme' },
    el('div', { class: 'sort-tete' },
      attaque.icon ? el('img', { class: 'icone-sort', src: attaque.icon, alt: '', decoding: 'async' }) : null,
      el('span', { class: 'nom-arme', text: attaque.name }),
      el('span', { class: 'meta-arme',
        title: 'Coût, cadence et portée de l\'arme',
        text: `${attaque.apCost ?? '?'} PA · ${attaque.castsPerTurn}/tour`
          + (Number(attaque.portee) > 0
            ? ` · ${attaque.portee} PO`
            : '') })),
    el('div', { class: 'lignes-arme' },
      attaque.lines.map((ligne) => ligneArme(ligne, `${ligne.min}–${ligne.max}`))),
    detail ? detailSort(detail) : null,
  ));
}

/**
 * Remplit la liste des sorts.
 *
 * @param {HTMLElement} root
 * @param {any[]} sorts
 * @param {any[]|null} degats Details calcules, un par sort.
 * @param {object} actions
 * @param {(index: number, cle: string, valeur: any) => void} actions.onChange
 * @param {(index: number) => void} actions.onRemove
 * @param {(index: number) => void} [actions.onAjouterLigne] Ajoute une ligne de degats.
 * @param {(index: number, rang: number) => void} [actions.onEnleverLigne]
 * @param {boolean} [actions.compterDiffere] Vrai quand les lignes des tours
 *   suivants entrent dans le total. Le signal visuel suit ce choix : une ligne
 *   estompee dit « ne compte pas », elle mentirait si elle comptait.
 */
export function renderSorts(root, sorts, degats, {
  onChange, onRemove, onAjouterLigne = null, onEnleverLigne = null,
  compterDiffere = false,
}) {
  if (sorts.length === 0) {
    fill(root, el('p', { class: 'note', text: 'Aucun sort. Le solveur ne vise que les conditions.' }));
    return;
  }

  fill(root, sorts.map((sort, index) => {
    // Chaque champ porte sa legende au-dessus : la grille se lit sans survol.
    const cellule = (titre, controle, aide) => el('label', {
      class: 'cellule-sort', title: aide ?? titre,
    }, el('span', { class: 'legende', text: titre }), controle);

    const champ = (cle, titre, aide, defaut = 0) => cellule(titre, el('input', {
      type: 'number', value: String(sort[cle] ?? defaut),
      onChange: (ev) => onChange(index, cle, Number(ev.target.value)),
    }), aide);
    const champLigne = (rang, ligne, cle, titre, aide) => cellule(titre, el('input', {
      type: 'number', value: String(ligne[cle] ?? 0),
      onChange: (ev) => onChange(index, `line.${rang}.${cle}`, Number(ev.target.value)),
    }), aide);

    const detail = degats?.[index];

    return el('div', { class: 'sort' },
      el('div', { class: 'sort-tete' },
        sort.icon ? el('img', { class: 'icone-sort', src: sort.icon, alt: '', decoding: 'async' }) : null,
        el('input', { type: 'text', value: sort.name ?? '', title: 'Nom du sort',
          onChange: (ev) => onChange(index, 'name', ev.target.value) }),
        sort.telefrag?.genere
          ? el('span', { class: 'marque-tf', title: 'Ce sort produit un telefrag', text: 'TF+' }) : null,
        sort.telefrag?.consomme
          ? el('span', { class: 'marque-tf consomme',
              title: sort.telefrag.bonusSousTelefrag
                ? 'Ce sort consomme un telefrag et gagne un bonus'
                : 'Ce sort consomme un telefrag', text: 'TF−' }) : null,
        el('button', { class: 'mini', type: 'button', text: '×', title: 'Enlever',
          onClick: () => onRemove(index) }),
      ),
      el('div', { class: 'sort-grille' },
        champ('apCost', 'PA', 'Coût du sort en points d\'action'),
        // Deux nombres voisins mais distincts : « Max/tour » borne
        // l'optimisateur de combo, « Lancers » compte les degats.
        champ('castsPerTurn', 'Max/tour',
          'Nombre maximal de lancers par tour.\n'
          + 'L\'optimisateur de combo ne dépasse jamais cette limite.'),
        champ('repeats', 'Lancers',
          'Nombre de lancers comptes dans les dégâts.\n'
          + '« Appliquer aux sorts » y met le nombre retenu par le combo.', 1),
        champ('baseCrit', 'Crit +%', 'Bonus de critique propre au sort'),
        cellule('1 max au combo', el('input', {
          type: 'checkbox', ...(sort.unParTour ? { checked: true } : {}),
          onChange: (ev) => onChange(index, 'unParTour', ev.target.checked),
        }), 'Coche : l\'optimisateur de combo ne lance ce sort qu\'une fois'),
      ),
      // Une rangee editable par ligne de degats : element, plage, plage critique.
      sort.lines.map((ligne, rang) => el('div', {
        class: ['sort-grille', 'ligne-sort',
          ligne.differe > 0 && !compterDiffere ? 'differee' : '',
          ligne.differe > 0 && compterDiffere ? 'differee-comptee' : '',
          onEnleverLigne && sort.lines.length > 1 ? 'otable' : ''].filter(Boolean).join(' ') },
        cellule(ligne.differe > 0 ? `Élément · T+${ligne.differe}` : 'Element',
          el('select', {
            onChange: (ev) => onChange(index, `line.${rang}.element`, ev.target.value) },
            ['neutre', 'terre', 'feu', 'eau', 'air'].map((e) => el('option', {
              value: e, ...(ligne.element === e ? { selected: true } : {}), text: e }))),
          ligne.differe > 0
            ? `Ligne différée : touche ${ligne.differe} tour(s) après le lancer.`
              + (compterDiffere
                ? ' Elle compte dans le score : l\'option « sorts des tours suivants » est cochée.'
                : ' Elle ne compte pas dans le score : cochez « sorts des tours suivants ».')
            : 'Élément de la ligne de dégâts'),
        champLigne(rang, ligne, 'min', 'Min', 'Dégâts de base minimaux'),
        champLigne(rang, ligne, 'max', 'Max', 'Dégâts de base maximaux'),
        champLigne(rang, ligne, 'critMin', 'Crit min', 'Dégâts de base minimaux en critique'),
        champLigne(rang, ligne, 'critMax', 'Crit max', 'Dégâts de base maximaux en critique'),
        // Le sort garde toujours une ligne : la derniere ne s'enleve pas.
        onEnleverLigne && sort.lines.length > 1
          ? el('button', { class: 'mini oter-ligne', type: 'button', text: '×',
              title: 'Enlever cette ligne de dégâts',
              onClick: () => onEnleverLigne(index, rang) })
          : null,
      )),
      onAjouterLigne
        ? el('div', { class: 'ajout-ligne' },
            el('button', { class: 'mini large', type: 'button', text: '+ ligne de dégâts',
              title: 'Ajoute une ligne de dégâts, dans le même élément ou dans un autre',
              onClick: () => onAjouterLigne(index) }))
        : null,
      detail ? detailSort(detail) : null,
    );
  }));
}


/**
 * Montre le combo optimise : lancers retenus, PA depenses et total.
 * @param {HTMLElement} root
 * @param {{total:number, budget:number, paUtilises:number, lancers:any[]} | null} combo
 */
export function renderCombo(root, combo, actions = {}) {
  if (!combo) {
    fill(root, []);
    return;
  }

  const lignes = combo.lancers.map((l) => el('div', { class: 'ligne-combo' },
    l.icon ? el('img', { src: l.icon, alt: '', decoding: 'async' }) : null,
    el('span', { class: 'nom', text: `${l.lancers} × ${l.name}` }),
    el('span', { class: 'pa', text: `${l.coutTotal} PA`
      + (l.rend > 0 ? ` (TF +${l.rend})` : '') }),
    el('span', { class: 'deg', text: entier(l.total) }),
  ));

  // Couverture d'elements : montree des qu'une condition existe ou que le
  // combo touche plusieurs elements.
  const couverts = combo.elementsCouverts ?? [];
  const manque = combo.elementsManquants ?? 0;
  const ligneElements = (combo.elementsMin > 0 || couverts.length > 1)
    ? el('div', { class: `elements-combo ${manque > 0 ? 'manque' : ''}`.trim() },
        couverts.map((e) => {
          const icone = iconeElement(e);
          return icone ? el('img', { src: icone, alt: e, title: e, decoding: 'async' })
            : el('span', { text: e });
        }),
        el('span', { class: 'note-elements',
          text: combo.elementsMin > 0
            ? `${couverts.length}/${combo.elementsMin} element(s) demandes`
              + (manque > 0 ? ' — budget insuffisant' : '')
            : `${couverts.length} élément(s)` }))
    : null;

  fill(root, [el('div', { class: 'carte-combo' },
    el('div', { class: 'tete-combo' },
      el('span', { class: 'titre', text: 'Combo optimise' }),
      el('span', { class: 'pa', text: `${combo.paUtilises}/${combo.budget} PA` })),
    combo.lancers.length > 0
      ? lignes
      : el('p', { class: 'note', text: 'Aucun lancer ne tient dans le budget de PA.' }),
    ligneElements,
    el('div', { class: 'total-combo' },
      el('span', { text: 'Dégâts du combo' }),
      el('span', { class: 'deg', text: entier(combo.total) })),
    combo.lancers.length > 0 && (actions.onAppliquer || actions.onGarder)
      ? el('div', { class: 'actions-combo' },
          actions.onAppliquer ? el('button', { class: 'mini large', type: 'button',
            text: 'Appliquer aux sorts',
            title: 'Remplace la liste des sorts par ceux du combo,\n'
              + 'avec leur nombre de lancers retenu',
            onClick: () => actions.onAppliquer(combo) }) : null,
          actions.onGarder ? el('button', { class: 'mini large', type: 'button',
            text: 'Garder en jeu de sorts',
            title: 'Enregistre les sorts du combo comme un jeu nommé',
            onClick: () => actions.onGarder(combo) }) : null)
      : null,
  )]);
}
