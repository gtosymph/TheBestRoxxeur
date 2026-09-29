/**
 * Le choix, sort par sort, de compter les lignes speciales.
 *
 * Une ligne speciale touche aux tours suivants (le Sablier frappe deux tours
 * apres le lancer) ou sous une condition (Aiguille frappe encore quand la
 * cible perd le Telefrag). Une seule option globale decidait pour tous les
 * sorts : compter le Sablier forcait a compter le Gousset. Chaque sort porte
 * maintenant son choix dans `speciales` ; l'option « toursSuivants » ne sert
 * plus que de valeur de depart, pour les sorts que le joueur n'a pas regles.
 */

/**
 * Ce que le sort garde de cote, ou null s'il n'a aucune ligne speciale.
 *
 * @param {any} sort
 * @returns {{libelle: string, aide: string}|null}
 */
export function resumeSpeciales(sort) {
  const lignes = sort?.lines ?? [];
  const tours = [...new Set(lignes.filter((l) => l.differe > 0).map((l) => l.differe))]
    .sort((a, b) => a - b);
  const conditions = [...new Set(lignes.filter((l) => l.condition).map((l) => l.condition))];
  if (tours.length === 0 && conditions.length === 0) return null;

  const morceaux = [
    ...tours.map((n) => `T+${n}`),
    ...(conditions.length > 0 ? ['cond.'] : []),
  ];
  const phrases = [
    ...(tours.length > 0
      ? [`Des dégâts touchent ${tours.map((n) => `${n} tour(s)`).join(' et ')} après le lancer.`]
      : []),
    ...conditions.map((condition) => `Le sort frappe encore ${minusculeInitiale(condition)}.`),
  ];

  return {
    libelle: morceaux.join(' · '),
    aide: `${phrases.join(' ')} Cochez pour les compter dans le total.`,
  };
}

/** « Si la cible… » devient « si la cible… », sans toucher aux noms propres. */
const minusculeInitiale = (texte) => texte.charAt(0).toLowerCase() + texte.slice(1);

/**
 * Vrai quand les lignes speciales du sort comptent.
 *
 * @param {{speciales?: boolean}} sort
 * @param {{toursSuivants?: boolean}} options
 * @returns {boolean}
 */
export function compteSpeciales(sort, options) {
  if (typeof sort?.speciales === 'boolean') return sort.speciales;
  return options?.toursSuivants === true;
}

/**
 * Rend la liste des sorts, avec le choix d'un seul sort change.
 *
 * @param {any[]} sorts
 * @param {number|string} id
 * @param {boolean} valeur
 * @returns {any[]}
 */
export function avecSpeciales(sorts, id, valeur) {
  return sorts.map((sort) => (sort.id === id ? { ...sort, speciales: Boolean(valeur) } : sort));
}

/**
 * Les plages qu'une variante montre dans le choix des sorts.
 *
 * La plage du tour ne compte que les coups surs. Un sort dont tous les coups
 * sont a part (Aiguille) montrait « 0–0 », comme un sort qui ne fait rien :
 * ce qui vient a part se montre donc a cote, precede d'un « + ».
 *
 * @param {{min: number, max: number, lines?: any[]}} variante
 * @returns {{tour: string, aPart: string|null}}
 */
export function plagesVariante(variante) {
  const speciales = (variante?.lines ?? []).filter((l) => l.differe > 0 || l.condition);
  const somme = (cle) => speciales.reduce((n, l) => n + (Number(l[cle]) || 0), 0);

  return {
    tour: variante.max > 0 ? `${variante.min}–${variante.max}` : '—',
    aPart: speciales.length > 0 ? `+${somme('min')}–${somme('max')}` : null,
  };
}
