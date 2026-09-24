/**
 * La rangee des sorts, dans le volet de gauche.
 *
 * Chaque sort porte son nombre de lancers et sa croix. Le survol montre le
 * sort tel que le moteur le compte, options comprises.
 */
import { el } from '../render.mjs';
import { avecLancers, lancersDe, limiteDe } from '../lancers.mjs';
import { buildCourant, cibleDe, sortsCalcules } from '../objectif.mjs';
import { cacherBulle, montrerBulleSort, suivreBulle } from '../hover-card.mjs';

import { resumeCombo } from './options.mjs';

/**
 * @param {object} liens
 * @param {(id: string) => HTMLElement} liens.$
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {() => any} liens.lireCatalogue
 * @param {() => any[]|null} liens.lireClassesSorts
 * @param {{ouvrir: () => void, toutEnlever: () => void}} liens.gestesSorts
 */
export function creerRenduSorts({
  $, lireEtat, setEtat, lireCatalogue, lireClassesSorts, gestesSorts,
}) {
  /**
   * Combien de fois ce sort part dans le tour.
   *
   * Le nombre entre dans le total des degats : c'est le seul endroit ou le
   * joueur dit ce qu'il lance vraiment. Un sort que le jeu ne laisse lancer
   * qu'une fois n'a rien a regler, et ne montre donc rien.
   *
   * L'optimisateur de combo garde la main quand il est actif : lui compte les
   * PA et decide lui-meme des lancers, borne par la limite du jeu.
   */
  function champLancers(sort) {
    const limite = limiteDe(sort);
    if (limite <= 1) return null;

    return el('input', {
      class: 'chip-lancers', type: 'number', min: '1', max: String(limite),
      value: String(lancersDe(sort)),
      'aria-label': `Lancers comptés pour ${sort.name ?? sort.fr ?? 'ce sort'}`,
      title: `Lancers comptés dans les dégâts (${limite} au maximum dans le jeu).`,
      onClick: (ev) => ev.stopPropagation(),
      onChange: (ev) => {
        setEtat({ sorts: avecLancers(lireEtat().sorts, sort.id, Number(ev.target.value)) });
      },
    });
  }

  /**
   * La fiche d'un sort dans le catalogue, pour sa portee et sa zone.
   * Le sort garde dans l'etat ce que le moteur lit ; le reste se relit ici.
   */
  function ficheDuSort(id) {
    for (const classe of lireClassesSorts() ?? []) {
      const trouve = (classe.spells ?? []).find((sort) => sort.id === id);
      if (trouve) return trouve;
    }
    return null;
  }

  function renderSorts() {
    const etat = lireEtat();
    const sorts = sortsCalcules(etat);
    $('compte-sorts').textContent = String(sorts.length);

    // Le sort SURVOLE est celui que le moteur compte, options comprises : la
    // portee, la cible telefrag et les tours suivants changent ses chiffres.
    // Montrer le sort nu donnerait un nombre que l'ecran ne confirme nulle part.
    const calcules = new Map(sorts.map((sort) => [sort.id, sort]));
    const stats = buildCourant(etat, lireCatalogue())?.stats ?? null;
    const cible = cibleDe(etat);

    $('chips-sorts').replaceChildren(...etat.sorts.map((sort) => el('span', {
      class: 'chip',
      onMouseenter: (ev) => montrerBulleSort(calcules.get(sort.id) ?? sort, ev.clientX, ev.clientY, {
        stats, cible, fiche: ficheDuSort(sort.id), ancre: ev.currentTarget,
      }),
      onMousemove: (ev) => suivreBulle(ev.clientX, ev.clientY),
      onMouseleave: cacherBulle,
    },
      sort.icon ? el('img', { src: sort.icon, alt: '', decoding: 'async' }) : null,
      sort.name ?? sort.fr ?? String(sort.id),
      champLancers(sort),
      el('button', {
        type: 'button', text: '×', title: `Enlever ${sort.name ?? sort.fr ?? 'ce sort'}`,
        onClick: () => setEtat({ sorts: lireEtat().sorts.filter((s) => s.id !== sort.id) }),
      }))));
    // Le bouton de l'enchainement porte l'etat du reglage : sans cela, il faut
    // l'ouvrir pour savoir si le combo compte ou non.
    $('etat-combo').textContent = resumeCombo(etat.options);
    $('aide-sorts').replaceChildren(
      ...(sorts.length ? [] : [
        'Aucun sort. L\'outil n\'en pose aucun d\'office : un chiffre de dégâts '
          + 'faux vaut moins que pas de chiffre.',
        el('br'),
      ]),
      el('button', { class: 'btn mini fantome', type: 'button', style: 'padding-left:0',
        text: sorts.length ? 'Changer mes sorts' : 'Choisir des sorts…',
        onClick: gestesSorts.ouvrir }),
      ...(sorts.length
        ? [el('button', { class: 'btn mini fantome', type: 'button',
            text: 'Tout enlever', onClick: gestesSorts.toutEnlever })]
        : []));
  }

  return { renderSorts };
}
