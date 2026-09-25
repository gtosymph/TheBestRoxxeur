/**
 * La fiche du stuff porte, dans le volet de droite.
 *
 * Deux lectures : l'essentiel, ou tout. Chaque ligne se clique pour devenir un
 * minimum a la valeur atteinte.
 */
import { el } from '../render.mjs';
import { buildCourant } from '../objectif.mjs';
import { iconeStat } from '../icons.mjs';

import { FAMILLE_CARACTERISTIQUES, lignesCompletes, lignesEssentielles } from './fiche.mjs';
import { ouvrirPoints } from './vue-points.mjs';
import { nombre } from './nombres.mjs';

/** La valeur d'une ligne : un seul chiffre, ou le brut et le pourcentage. */
function valeurDe(l) {
  // Une resistance porte deux chiffres : le brut et le pourcentage. Ils
  // ne se lisent jamais l'un sans l'autre.
  if (l.pourcent === null || l.pourcent === undefined) {
    return el('b', { class: `ligne-val n ${l.muet ? 'vide-mesure' : ''}`.trim(),
      text: l.muet ? '—' : nombre(l.valeur) });
  }
  return el('span', { class: 'ligne-paire' },
    el('b', { class: `n ${l.sansBrut ? 'vide-mesure' : ''}`.trim(),
      title: 'Retire au coup', text: l.sansBrut ? '—' : nombre(l.valeur) }),
    el('b', { class: 'n pct', title: 'Retranche en pourcentage',
      text: `${nombre(l.pourcent)} %` }));
}

/**
 * @param {object} liens
 * @param {(id: string) => HTMLElement} liens.$
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {() => any} liens.lireCatalogue
 * @param {() => void} liens.render
 * @param {(stat: string, valeur: number) => void} liens.poserMinimum
 */
export function creerRenduInspecteur({
  $, lireEtat, setEtat, lireCatalogue, render, poserMinimum,
}) {
  /** Vrai quand « tout voir » remplace l'essentiel dans le volet d'inspection. */
  let toutVoir = false;

  const titreFamille = (l) => el('p', { class: 'famille' }, l.famille,
    l.famille === FAMILLE_CARACTERISTIQUES
      ? el('button', {
          class: 'btn mini fantome', type: 'button', text: 'Répartir mes points',
          onClick: () => ouvrirPoints({
            lireEtat, setEtat,
            lireStats: () => buildCourant(lireEtat(), lireCatalogue())?.stats ?? null,
          }),
        })
      : null);

  const ligneMesure = (l) => el('button', {
    // `exigee` et `sousMinimum` disent la meme chose vue de deux listes :
    // cette mesure est une des votres. Elle se reconnait sans lire, a son
    // fond et a son filet, parce que c'est elle qu'on vient verifier.
    class: `ligne ${l.exigee || l.sousMinimum ? 'exigee' : ''}`.trim(), type: 'button',
    ...(l.muet ? { disabled: true } : {}),
    title: l.exigee || l.sousMinimum
      ? `${l.libelle} est déjà dans vos minimums.`
      : `Garder au moins ${nombre(l.valeur)} de ${l.libelle.toLowerCase()}.`,
    onClick: () => poserMinimum(l.cle, l.valeur),
  },
    el('img', { class: 'ligne-icone', src: iconeStat(l.cle) ?? '', alt: '', decoding: 'async' }),
    el('span', { class: 'ligne-nom', text: l.libelle }),
    // Ce que la repartition des points apporte, juste devant le total.
    // Une Force a 520 ne dit pas d'ou elle vient : le stuff en donne une
    // part, les parchemins une autre, et les points le reste — et c'est
    // ce dernier que le joueur a choisi, donc le seul qu'il peut reprendre.
    // La colonne existe meme vide : sans elle, les totaux des lignes sans
    // parenthese se calent une colonne plus tot, et la fiche perd son
    // alignement au premier point investi.
    el('span', { class: 'ligne-investi n',
      ...(l.investi ? {
        text: `(${nombre(l.investi)})`,
        title: `${nombre(l.investi)} de ${l.libelle.toLowerCase()} viennent de `
          + `votre répartition, pour ${nombre(l.coutInvesti)} point(s) dépensés.`,
      } : {}) }),
    valeurDe(l));

  function renderInspecteur(stats, degats) {
    const etat = lireEtat();
    const minimums = etat.conditions.map((c) => c.stat);
    const lignes = toutVoir
      ? lignesCompletes(stats, new Set(minimums), etat.allocation)
      : lignesEssentielles(stats, minimums,
          { degats, pdvEffectifs: Number(stats.pdvEffectifs) || 0 }, etat.allocation);

    $('tete-quoi').textContent = toutVoir ? 'Tout voir' : 'La fiche';
    $('tete-note').textContent = 'stuff porté';

    $('corps-inspecteur').replaceChildren(
      ...lignes.map((l) => (l.famille ? titreFamille(l) : ligneMesure(l))),
      el('button', {
        class: 'btn mini fantome', type: 'button', style: 'margin:14px 16px',
        onClick: () => { toutVoir = !toutVoir; render(); },
        text: toutVoir ? 'Voir l\'essentiel' : 'Tout voir',
      }));
  }

  return { renderInspecteur };
}
