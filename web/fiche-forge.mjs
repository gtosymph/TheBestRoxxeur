/**
 * Bloc « Forgemagie » de la fiche d'une piece portee.
 *
 * Trois boutons posent ou enlevent un exo rare (PA, PM, portee) ; un seul
 * tient a la fois, comme en jeu. Sous chaque ligne, un champ dit ce que le
 * forgemage a obtenu au-dela du jet parfait.
 */
import { el } from './render.mjs';
import { iconeStat } from './icons.mjs';
import { STAT_LABELS } from '../src/data/stats.mjs';
import { EXOS_RARES } from '../src/engine/exos.mjs';
import { LIBELLE_EXO, lignesAvecExos } from './exos-piece.mjs';

const nombre = (v) => (v > 0 ? `+${Math.round(v)}` : String(Math.round(v)));

/**
 * Lignes de statistiques de la fiche, part d'exo marquee.
 *
 * @param {any} item
 * @param {any} exo Forgemagie de la piece, ou null.
 * @param {((stat: string, valeur: string) => void)|null} onOver Champ d'over par ligne.
 */
export function listeStats(item, exo, onOver = null) {
  const lignes = lignesAvecExos(item, exo)
    .filter((l) => l.valeur !== 0 || l.exo !== 0)
    .sort((a, b) => Math.abs(b.valeur) - Math.abs(a.valeur));
  if (lignes.length === 0) return el('p', { class: 'note', text: 'Cette pièce ne porte aucune statistique.' });

  return el('dl', { class: `fiche-stats${onOver ? ' forge' : ''}` }, lignes.flatMap((ligne) => {
    const icone = iconeStat(ligne.cle);
    // PA, PM et portee ne s'overent pas : elles se posent en exo rare.
    const rare = EXOS_RARES.includes(ligne.cle);
    return [
      el('dt', {},
        icone ? el('img', { src: icone, alt: '', decoding: 'async' }) : null,
        el('span', { text: STAT_LABELS[ligne.cle] ?? ligne.cle }),
        ligne.exo ? el('span', { class: 'badge-exo', text: rare && ligne.base === 0 ? 'exo' : 'over' }) : null),
      el('dd', { class: ligne.valeur > 0 ? 'pos' : 'neg' },
        el('span', { text: nombre(ligne.valeur) }),
        onOver && !rare
          ? el('input', {
              type: 'number', class: 'over', value: ligne.exo || '', placeholder: 'over',
              title: `Points de ${STAT_LABELS[ligne.cle] ?? ligne.cle} au-delà du jet parfait`,
              'aria-label': `Over de ${STAT_LABELS[ligne.cle] ?? ligne.cle}`,
              onChange: (ev) => onOver(ligne.cle, ev.target.value),
            })
          : null),
    ];
  }));
}

/**
 * Boutons des exos rares.
 *
 * @param {any} item
 * @param {any} exo
 * @param {(cle: string) => void} onExoRare
 */
export function blocExosRares(item, exo, onExoRare) {
  return el('div', { class: 'fiche-forge' },
    el('div', { class: 'titre-forge', text: 'Forgemagie' }),
    el('div', { class: 'exos-rares' }, EXOS_RARES.map((cle) => {
      const natif = Boolean(item.stats?.[cle]);
      const pose = Boolean(exo?.[cle]);
      return el('button', {
        type: 'button', class: pose ? 'pose' : '', disabled: natif,
        text: `Exo ${LIBELLE_EXO[cle]}${pose ? ' ✓' : ''}`,
        title: natif
          ? `Cette pièce porte déjà ${LIBELLE_EXO[cle]} : l'exo n'y a pas sa place.`
          : (pose ? 'Enlever cet exo' : `Poser un exo ${LIBELLE_EXO[cle]} sur cette pièce`),
        onClick: () => onExoRare(cle),
      });
    })),
    el('div', { class: 'fiche-note',
      text: 'Un seul exo rare par pièce. Les champs « over » disent ce que vous avez obtenu au-delà du jet parfait.' }),
  );
}
