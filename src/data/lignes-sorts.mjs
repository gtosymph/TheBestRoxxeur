/**
 * Les lignes de degats d'un sort, lues dans les donnees du jeu.
 *
 * Un palier de sort porte une liste d'effets. Tous ne sont pas des degats, et
 * surtout : tous ne frappent pas la meme chose. Le jeu decrit un seul coup
 * autant de fois qu'il a de publics — la cible visee, la zone autour du
 * lanceur, les invocations, les allies. Les additionner donne des degats que
 * personne ne prend jamais.
 *
 * Ce module ne garde donc que ce qu'un ennemi unique encaisse vraiment. Il
 * vivait dans le script d'import ; il en est sorti pour etre verifie, parce
 * qu'une regle fausse ici se lit partout dans l'outil sans jamais lever
 * d'erreur.
 */

/**
 * Element de chaque effet de degats (vol de vie compris).
 *
 * L'effet 5 est la POUSSEE. Elle ne suit aucune caracteristique : le moteur
 * lui applique sa propre regle (src/engine/damage.mjs). Elle reste ici parce
 * qu'elle frappe, et que soixante-trois sorts la portent.
 */
export const ELEMENT_EFFET = Object.freeze({
  97: 'terre', 92: 'terre',
  99: 'feu', 94: 'feu',
  96: 'eau', 91: 'eau',
  98: 'air', 93: 'air',
  100: 'neutre', 95: 'neutre',
  5: 'poussee',
});

/**
 * Decompose un masque de cible en groupes et conditions d'etat.
 * @param {string} masque
 */
export function lireMasque(masque) {
  const jetons = String(masque ?? '').split(',').filter(Boolean);
  const etats = jetons.filter((j) => /^E\d+$/.test(j));
  return {
    groupes: jetons.filter((j) => /^[A-Za-z]+$/.test(j)),
    // E majuscule sans etoile : la ligne exige un etat sur la cible
    // (Tempete de Puissance, Fleche Devorante). Les jetons etoiles *E<id>
    // portent au contraire les degats de base de certains sorts (Glas).
    exigeEtat: etats.length > 0,
    etats,
  };
}

/** La zone d'un effet, sous une forme comparable. */
const zoneDe = (effet) => {
  const z = effet?.zoneDescr;
  if (!z) return 'aucune';
  return `${z.shape ?? ''}:${z.param1 ?? ''}:${z.param2 ?? ''}`;
};

/**
 * Extrait les lignes de degats d'un palier.
 *
 * Regles, verifiees sur les fiches du jeu :
 *   1. une ligne qui exige un etat (E<id>) sort du calcul de base ;
 *   2. si des lignes visent les ennemis (groupe A), les autres cibles
 *      (invocations, allies) sortent : elles doublaient les totaux ;
 *   3. des lignes identiques sous des masques differents decrivent le meme
 *      coup : un seul masque reste ;
 *   4. des lignes identiques sous des ZONES differentes decrivent elles aussi
 *      le meme coup, vu de deux endroits. Pendule porte deux fois « 33 a 36
 *      Air » : une fois sur la cible, une fois sur le cercle autour du
 *      lanceur. Le jeu l'ecrit noir sur blanc — « les effets ne sont
 *      appliques qu'une seule fois par lancer ». Un ennemi n'en prend qu'un ;
 *   5. un delai (delay) marque la ligne comme differee : elle touche aux
 *      tours suivants.
 *
 * @param {{effects?: any[], criticalEffect?: any[]}} palier
 * @returns {{element: string, min: number, max: number, critMin: number,
 *   critMax: number, differe?: number}[]}
 */
export function lignesDuPalier(palier) {
  const garde = (e) => ELEMENT_EFFET[e.effectId] !== undefined;
  const normaux = (palier?.effects ?? []).filter(garde);
  const critiques = (palier?.criticalEffect ?? []).filter(garde);

  const avecDegats = normaux.map((effet, rang) => {
    const crit = critiques[rang] ?? effet;
    const { groupes, exigeEtat, etats } = lireMasque(effet.targetMask);
    return {
      element: ELEMENT_EFFET[effet.effectId],
      min: effet.diceNum || effet.value || 0,
      max: effet.diceSide || effet.diceNum || effet.value || 0,
      critMin: crit.diceNum || crit.value || 0,
      critMax: crit.diceSide || crit.diceNum || crit.value || 0,
      differe: Number(effet.delay ?? 0),
      groupes,
      exigeEtat,
      etats,
      masque: String(effet.targetMask ?? ''),
      zone: zoneDe(effet),
    };
  }).filter((l) => l.max > 0);

  // Toutes les lignes sous un etat, et plusieurs etats distincts : ce ne sont
  // pas des conditions mais des ALTERNATIVES. Traversee et Drain Elementaire
  // du Huppermage frappent dans l'element de la rune posee, une seule des
  // quatre lignes s'applique. Les cumuler quadruplait leurs degats.
  const sousEtat = avecDegats.filter((l) => l.exigeEtat);
  const distincts = new Set(sousEtat.flatMap((l) => l.etats));
  if (avecDegats.length > 0 && sousEtat.length === avecDegats.length && distincts.size > 1) {
    const meilleure = [...avecDegats].sort((a, b) => (b.min + b.max) - (a.min + a.max))[0];
    return [nettoyer(meilleure)];
  }

  const brutes = avecDegats.filter((l) => !l.exigeEtat);

  const surEnnemis = brutes.filter((l) => l.groupes.includes('A'));
  const retenues = surEnnemis.length > 0 ? surEnnemis : brutes;

  // Par valeurs identiques : au plus le nombre de repetitions d'un MEME
  // couple masque et zone. Deux coups identiques sur la meme case sont deux
  // coups ; les memes sous deux zones sont un seul coup, ecrit deux fois.
  const parCle = new Map();
  for (const ligne of retenues) {
    const cle = `${ligne.element}|${ligne.min}|${ligne.max}|${ligne.critMin}|${ligne.critMax}|${ligne.differe}`;
    if (!parCle.has(cle)) parCle.set(cle, new Map());
    const publics = parCle.get(cle);
    const ou = `${ligne.masque}@${ligne.zone}`;
    publics.set(ou, [...(publics.get(ou) ?? []), ligne]);
  }

  const finales = [];
  for (const publics of parCle.values()) {
    const meilleures = [...publics.values()].sort((a, b) => b.length - a.length)[0];
    finales.push(...meilleures);
  }

  return finales.map(nettoyer);
}

/** Ne garde que ce que le moteur lit. */
function nettoyer({ element, min, max, critMin, critMax, differe }) {
  return {
    element, min, max, critMin, critMax,
    ...(differe > 0 ? { differe } : {}),
  };
}
