/**
 * Une ligne de la liste des simulations gardees.
 *
 * La ligne ne garde aucun etat : le panneau lui dit si elle est cochee, et
 * chaque geste remonte au panneau, qui redessine.
 */
import { el } from './render.mjs';
import { cacherBulle, montrerBulle, suivreBulle } from './hover-card.mjs';
import { libelle } from './simulations.mjs';

const entier = (v) => Math.floor(v).toLocaleString('fr-FR');

/** Date courte, lisible d'un coup d'oeil. */
function quand(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * @param {any} simulation
 * @param {object} contexte
 * @param {boolean} contexte.cochee Vrai quand la ligne est cochee pour comparer.
 * @param {any} contexte.selection Le choix de la comparaison de v2, ou null.
 * @param {Map<number, any>} contexte.catalogue Les pieces, par identifiant.
 * @param {(id: string) => void} contexte.onBasculer
 * @param {(id: string) => void} contexte.onFavori
 * @param {(simulation: any) => void} contexte.onRenommer
 * @param {(simulation: any) => void} contexte.onRestaurer
 * @param {((simulation: any) => void)|null} contexte.onFiger
 * @param {(id: string) => void} contexte.onEnlever
 */
export function ligneSimulation(simulation, contexte) {
  const {
    cochee, selection, catalogue, nomDeClasse, embleme,
    onBasculer, onFavori, onRenommer, onRestaurer, onFiger, onEnlever,
  } = contexte;
  const pieces = simulation.pieces ?? [];
  const nom = libelle(simulation, nomDeClasse);

  const marques = [
    'simulation',
    cochee ? 'cochee' : '',
    simulation.favori ? 'favori' : '',
  ].filter(Boolean).join(' ');

  return el('div', { class: marques, 'data-simulation': simulation.id },
    el('label', { class: 'simulation-coche',
      title: selection
        ? 'Comparer cet essai avec les autres stuffs choisis'
        : 'Cocher deux simulations pour les comparer' },
      selection
        ? el('input', { type: 'checkbox',
            ...(selection.choisis.has(simulation) ? { checked: true } : {}),
            onChange: () => selection.onBasculer(simulation) })
        : el('input', { type: 'checkbox', ...(cochee ? { checked: true } : {}),
            onChange: () => onBasculer(simulation.id) })),

    // L'etoile remonte l'essai en tete et le met a l'abri du menage : la
    // liste est bornee, un favori ne part jamais pour faire de la place.
    el('button', { class: `simulation-favori ${simulation.favori ? 'actif' : ''}`.trim(),
      type: 'button', text: simulation.favori ? '\u2605' : '\u2606',
      'aria-pressed': simulation.favori ? 'true' : 'false',
      title: simulation.favori
        ? 'Enlever des favoris'
        : 'Mettre en favori : la simulation remonte en tête et reste gardée',
      onClick: () => onFavori(simulation.id) }),

    el('img', { class: 'simulation-embleme', src: embleme(simulation.classe),
      alt: '', title: nomDeClasse(simulation.classe), decoding: 'async' }),

    el('div', { class: 'simulation-corps' },
      el('div', { class: 'simulation-tete' },
        el('span', { class: 'simulation-nom', text: nom, title: 'Cliquer pour renommer',
          onClick: () => onRenommer(simulation) }),
        // Le crayon dit que le nom se change. Le clic sur le texte marche
        // toujours, mais rien ne l'annoncait : un essai garde restait
        // « Iop 190 » parmi dix autres « Iop 190 ».
        el('button', { class: 'mini simulation-renommer', type: 'button', text: '✎',
          title: 'Renommer cette simulation',
          'aria-label': `Renommer ${nom}`,
          onClick: () => onRenommer(simulation) }),
        el('span', { class: `simulation-score ${simulation.tenu ? 'pos' : 'neg'}`,
          text: entier(simulation.score ?? 0),
          title: simulation.tenu
            ? 'Toutes les conditions sont tenues'
            : `${simulation.manquantes ?? 0} minimum(s) non tenu(s)` })),
      el('div', { class: 'simulation-sous',
        text: `${nomDeClasse(simulation.classe)} ${simulation.niveau}`
          + ` · ${pieces.length} pièce(s) · ${quand(simulation.date)}` }),
      // Le stuff se lit sur la ligne meme : sans lui, deux essais au meme
      // score restent indiscernables.
      el('div', { class: 'simulation-stuff' },
        pieces.map(({ id }) => {
          const piece = catalogue.get(id);
          return piece ? el('img', {
            src: piece.img, alt: '', title: piece.fr, decoding: 'async', loading: 'lazy',
            onMouseenter: (ev) => montrerBulle(piece, ev.clientX, ev.clientY, { ancre: ev.currentTarget }),
            onMousemove: (ev) => suivreBulle(ev.clientX, ev.clientY),
            onMouseleave: cacherBulle,
          }) : null;
        }))),

    el('div', { class: 'simulation-actions' },
      el('button', { class: 'mini large', type: 'button', text: 'Remettre',
        title: 'Remet ce build, ses conditions, ses sorts et ses réglages',
        onClick: () => onRestaurer(simulation) }),
      // Figer ne touche pas au build pose : le joueur garde son essai en
      // cours et change seulement le point de comparaison des achats.
      onFiger ? el('button', { class: 'mini', type: 'button', text: 'Figer',
        title: 'Prend ce stuff comme stuff porté en jeu, sans toucher au build pose',
        onClick: () => onFiger(simulation) }) : null,
      el('button', { class: 'mini', type: 'button', text: '×', title: 'Enlever cette simulation',
        onClick: () => onEnlever(simulation.id) })),
  );
}
