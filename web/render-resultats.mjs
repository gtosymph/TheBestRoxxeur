/**
 * Rendu des resultats : l'analyse du stuff, les stuffs trouves et les
 * panoplies actives.
 */
import { decrireExos } from './exos-piece.mjs';
import { iconeStat } from './icons.mjs';
import { cacherBulle, montrerBulle, suivreBulle } from './hover-card.mjs';
import {
  el, entier, fill, nombre, ton, vignette,
} from './render-outils.mjs';

/**
 * Remplit l'analyse du build : apport des pieces et statistiques qui paient.
 *
 * L'apport d'une piece vaut ce que le build perd sans elle ; la barre le
 * montre a l'echelle de la piece la plus utile. Les statistiques, elles,
 * repondent a la question suivante : ou mettre le prochain point gagne.
 *
 * @param {HTMLElement} racineApports
 * @param {HTMLElement} racineSensibilite
 * @param {object} analyse
 * @param {any[]} analyse.apports
 * @param {any[]} analyse.sensibilite
 * @param {Map<number, any>} analyse.itemById
 * @param {Record<string, string>} analyse.libelles
 */
export function renderAnalyse(racineApports, racineSensibilite, analyse) {
  const { apports, sensibilite, itemById, libelles } = analyse;

  // La jauge suit les degats : le score melange degats et penalites, une piece
  // qui rend un point d'action y paraitrait plus utile qu'une piece de degats.
  const fort = Math.max(1, ...apports.map((a) => a.degats ?? 0));
  fill(racineApports, apports.map((apport) => {
    const piece = itemById.get(apport.id);
    const part = Math.min(100, Math.round(((apport.degats ?? 0) / fort) * 100));

    return el('div', {
      class: `apport ${apport.casseCondition ? 'decisive' : ''}`.trim(),
      title: apport.casseCondition
        ? `${apport.fr} — sans elle, ces conditions tombent : `
          + `${(apport.conditionsPerdues ?? []).map((stat) => libelles[stat] ?? stat).join(', ')}`
        : `${apport.fr} — sans elle, le build perd ${entier(apport.degats ?? 0)} dégâts`,
    },
      piece?.img
        ? el('img', { class: 'apport-icone', src: piece.img, alt: '', decoding: 'async',
            onMouseenter: (ev) => montrerBulle(piece, ev.clientX, ev.clientY,
              { ancre: ev.currentTarget }),
            onMousemove: (ev) => suivreBulle(ev.clientX, ev.clientY),
            onMouseleave: cacherBulle })
        : null,
      el('span', { class: 'apport-nom', text: apport.fr }),
      el('span', { class: 'apport-jauge' }, el('i', { style: `width:${part}%` })),
      apport.casseCondition
        ? el('span', { class: 'apport-marque', title: 'Sans cette pièce, une condition tombe', text: '!' })
        : null,
      el('span', { class: `apport-valeur ${ton(apport.degats ?? 0)}`,
        text: `+${entier(apport.degats ?? 0)}` }));
  }));

  // Une statistique sans effet n'apprend rien : seules les utiles restent.
  const utiles = sensibilite.filter((mesure) => mesure.gain > 0).slice(0, 8);
  if (utiles.length === 0) {
    fill(racineSensibilite, el('p', { class: 'note', text: 'Aucun sort retenu : rien à conseiller.' }));
    return;
  }

  const meilleur = utiles[0].gain;
  fill(racineSensibilite, utiles.map((mesure) => {
    const icone = iconeStat(mesure.stat);
    const part = Math.min(100, Math.round((mesure.gain / meilleur) * 100));
    // Les libelles portent deja leur unite : « % Dommages Melee », « % Critique ».
    const unite = '';

    return el('div', { class: 'mesure', title: `${mesure.pas}${unite} de plus sur cette statistique rend ${entier(mesure.gain)} dégâts` },
      icone ? el('img', { class: 'mesure-icone', src: icone, alt: '', decoding: 'async' }) : null,
      el('span', { class: 'mesure-nom', text: `+${mesure.pas}${unite} ${libelles[mesure.stat] ?? mesure.stat}` }),
      el('span', { class: 'apport-jauge' }, el('i', { style: `width:${part}%` })),
      el('span', { class: 'mesure-gain', text: `+${entier(mesure.gain)}` }));
  }));
}

/**
 * Remplit la liste des autres builds trouves.
 *
 * Un solveur qui ne rend qu'un gagnant cache ses seconds : ils valent
 * souvent quelques degats de moins pour deux pieces que le joueur possede
 * deja. Chaque ligne dit donc ce qu'il faut changer, et ce que cela coute.
 *
 * @param {HTMLElement} root
 * @param {any[]} candidats
 * @param {object} contexte
 * @param {Set<number>} contexte.portes Identifiants du build porte.
 * @param {Map<number, any>} contexte.itemById
 * @param {number|null} contexte.scorePorte Score du build porte, ou null.
 * @param {(candidat: any) => void} contexte.onPorter
 */
export function renderCandidats(root, candidats, { portes, itemById, porte, onPorter, selection = null }) {
  if (!candidats || candidats.length === 0) {
    fill(root, el('p', { class: 'note', text: 'Aucun autre build. Lancez une recherche.' }));
    return;
  }

  fill(root, candidats.map((candidat) => {
    const ids = candidat.itemIds ?? [];
    const aMettre = ids.filter((id) => !portes.has(id));
    const aEnlever = [...portes].filter((id) => !ids.includes(id));
    // L'ecart se lit sur les DEGATS, jamais sur le score. Un score vaut les
    // degats quand les conditions tiennent, et moins la penalite quand l'une
    // d'elles tombe : soustraire l'un de l'autre annoncait des ecarts de
    // plusieurs milliers de points qui ne voulaient rien dire.
    const ecart = Number.isFinite(porte?.damage) ? (candidat.damage ?? 0) - porte.damage : null;
    const redresse = candidat.satisfied === true && porte?.satisfied === false;
    const casse = candidat.satisfied === false && porte?.satisfied === true;

    // Un build deja porte se signale : il n'y a rien a changer.
    const identique = aMettre.length === 0 && aEnlever.length === 0;

    const vignette = (id, classe) => {
      const piece = itemById.get(id);
      if (!piece) return null;
      return el('img', {
        class: `piece-candidat ${classe}`,
        src: piece.img, alt: piece.fr, title: piece.fr, decoding: 'async',
        onMouseenter: (ev) => montrerBulle(piece, ev.clientX, ev.clientY,
          { ancre: ev.currentTarget }),
        onMousemove: (ev) => suivreBulle(ev.clientX, ev.clientY),
        onMouseleave: cacherBulle,
      });
    };

    return el('div', { class: `candidat ${identique ? 'porte' : ''}`.trim() },
      el('div', { class: 'candidat-tete' },
        // La case a cocher n'existe que si l'appelant sait quoi en faire :
        // v1 ne compare pas, elle ne doit pas voir apparaitre une case inerte.
        selection
          ? el('label', { class: 'candidat-cocher', title: 'Comparer ce stuff' },
              el('input', {
                type: 'checkbox',
                ...(selection.choisis.has(candidat) ? { checked: true } : {}),
                onChange: () => selection.onBasculer(candidat),
              }))
          : null,
        el('span', { class: 'candidat-score', title: 'Dégâts de ce build',
          text: entier(candidat.damage ?? 0) }),
        ecart === null || identique
          ? null
          : el('span', {
              class: `candidat-ecart ${ecart >= 0 ? 'pos' : 'neg'}`,
              text: `${ecart >= 0 ? '+' : ''}${entier(ecart)}`,
              title: 'Dégâts en plus ou en moins, face au build porté',
            }),
        redresse
          ? el('span', { class: 'candidat-marque',
              title: 'Le stuff porté laisse un minimum non tenu ; celui-ci les tient tous',
              text: 'minimums tenus' })
          : null,
        casse
          ? el('span', { class: 'candidat-marque defaut',
              title: 'Ce stuff ne tient pas tous vos minimums',
              text: 'minimums non tenus' })
          : null,
        el('span', { class: 'candidat-changements',
          text: identique ? 'build porté' : `${aMettre.length} pièce(s) à changer` }),
        identique
          ? null
          : el('button', { class: 'mini large', type: 'button', text: 'Porter',
              title: 'Remplace le build porté par celui-ci',
              onClick: () => onPorter(candidat) })),

      identique ? null : el('div', { class: 'candidat-pieces' },
        el('span', { class: 'candidat-legende', text: 'a mettre' }),
        aMettre.map((id) => vignette(id, 'entrante')),
        aEnlever.length > 0 ? el('span', { class: 'candidat-legende', text: 'a enlever' }) : null,
        aEnlever.map((id) => vignette(id, 'sortante'))),

      // Les exos que le solveur a poses : sans cette ligne, le joueur porterait
      // le build et n'obtiendrait pas les degats annonces.
      candidat.exos?.length
        ? el('div', { class: 'candidat-exos', text: decrireExos(candidat.exos, itemById) })
        : null,
    );
  }));
}

/**
 * Remplit les cartes de panoplie.
 * @param {HTMLElement} root
 * @param {any[]} panoplies Panoplies actives du build.
 * @param {Map<number, any>} setById
 * @param {Record<string, string>} libelles
 * @param {{itemById?: Map<number, any>, equippedIds?: Set<number>}} [contexte]
 */
export function renderPanoplies(root, panoplies, setById, libelles, contexte = {}) {
  const { itemById = new Map(), equippedIds = new Set() } = contexte;

  if (!panoplies || panoplies.length === 0) {
    fill(root, el('p', { class: 'note', text: 'Aucune panoplie active.' }));
    return;
  }

  fill(root, panoplies.map(({ setId, pieces, fr }) => {
    const set = setById.get(setId);
    const tier = set?.tiers?.[pieces - 1] ?? {};
    const lignes = Object.entries(tier).filter(([, v]) => v !== 0);

    // Les pieces de la panoplie : les portees en clair, les autres en retrait.
    const vignettes = (set?.itemIds ?? [])
      .map((id) => itemById.get(id))
      .filter(Boolean)
      .sort((a, b) => Number(equippedIds.has(b.id)) - Number(equippedIds.has(a.id)))
      .map((piece) => el('img', {
        class: `piece-panoplie ${equippedIds.has(piece.id) ? 'portee' : 'absente'}`,
        src: piece.img, alt: piece.fr, title: piece.fr, decoding: 'async',
        // Le survol montre l'infobulle de la piece ; le clic ouvre sa fiche.
        onMouseenter: (ev) => montrerBulle(piece, ev.clientX, ev.clientY,
          { ancre: ev.currentTarget }),
        onMousemove: (ev) => suivreBulle(ev.clientX, ev.clientY),
        onMouseleave: cacherBulle,
        ...(contexte.onPick ? { onClick: () => { cacherBulle(); contexte.onPick(piece); } } : {}),
      }));

    return el('div', { class: 'panoplie' },
      el('div', { class: 'panoplie-tete' },
        el('span', { text: fr }),
        el('span', { class: 'pieces', text: `${pieces} pièces` })),
      vignettes.length > 0 ? el('div', { class: 'pieces-panoplie' }, vignettes) : null,
      el('dl', {}, lignes.flatMap(([cle, valeur]) => {
        const icone = iconeStat(cle);
        return [
          el('dt', {},
            icone ? el('img', { src: icone, alt: '', decoding: 'async' }) : null,
            el('span', { text: libelles[cle] ?? cle })),
          el('dd', { class: valeur > 0 ? 'pos' : 'neg', text: nombre(valeur) }),
        ];
      })),
    );
  }));
}
