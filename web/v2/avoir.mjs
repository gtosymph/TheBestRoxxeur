/**
 * Les trois listes que le joueur tient lui-meme.
 *
 * Sa banque, ce qu'il refuse, et le stuff qu'il porte en jeu. Le volet gauche
 * en donnait le COMPTE, et rien d'autre : aucun chemin ne menait aux pieces
 * elles-memes. Trois bascules les ouvrent maintenant dans la palette, chacune
 * a cote des filtres ordinaires, parce qu'une liste se lit aussi par case et
 * par nom : « mes anneaux en banque » est une vraie question.
 *
 * Ce module ne touche pas au document : il decrit ce que les bascules disent.
 */

/** Les trois listes, dans l'ordre ou elles se montrent. */
export const LISTES_AVOIR = Object.freeze(['banque', 'interdits', 'stuff']);

const FICHES = Object.freeze({
  banque: { libelle: 'En banque', titre: 'Les pièces que vous avez déjà.' },
  interdits: { libelle: 'Interdites', titre: 'Les pièces que le solveur ne proposera plus.' },
  stuff: { libelle: 'Mon stuff', titre: 'Les pièces du stuff que vous avez figé.' },
});

/** Combien de pieces une liste tient. */
function compteDe(etat, cle) {
  if (cle === 'banque') return etat?.possedees?.size ?? 0;
  if (cle === 'interdits') return etat?.bannis?.size ?? 0;
  return etat?.reference?.itemIds?.length ?? 0;
}

/**
 * Ce que les trois bascules montrent.
 *
 * Une liste vide reste cliquable : montrer une grille vide repond a la
 * question. Le stuff fait exception, parce qu'il n'existe pas tant que rien
 * n'est fige : la bascule dit alors pourquoi elle ne s'ouvre pas.
 *
 * @param {any} etat
 * @returns {{cle: string, libelle: string, titre: string, compte: number,
 *   actif: boolean, possible: boolean}[]}
 */
export function basculesAvoir(etat) {
  const pose = etat?.filtreAvoir ?? null;
  return LISTES_AVOIR.map((cle) => {
    const compte = compteDe(etat, cle);
    const possible = cle !== 'stuff' || compte > 0;
    return {
      cle,
      libelle: FICHES[cle].libelle,
      titre: possible
        ? FICHES[cle].titre
        : 'Aucun stuff figé. Figez d\'abord celui que vous portez en jeu.',
      compte,
      actif: pose === cle,
      possible,
    };
  });
}

/**
 * Ce que le pied de la palette dit, selon la liste montree.
 *
 * Une grille vide sans un mot inquiete : le joueur croit a une panne alors
 * que sa liste est simplement vide.
 *
 * @param {string|null} liste
 * @param {number} compte Pieces montrees.
 * @returns {string}
 */
export function aideAvoir(liste, compte) {
  if (!liste) {
    return 'Cliquez une pièce pour la poser. Sa fiche porte : interdire, '
      + 'toujours garder, je l\'ai déjà.';
  }
  if (compte === 0) {
    if (liste === 'banque') {
      return 'Aucune pièce en banque. Ouvrez la fiche d\'une pièce et '
        + 'choisissez « Je l\'ai déjà ».';
    }
    if (liste === 'interdits') {
      return 'Aucune pièce interdite. Ouvrez la fiche d\'une pièce et '
        + 'choisissez « Interdire ».';
    }
    return 'Aucune pièce dans ce stuff.';
  }
  return 'Cliquez une pièce pour l\'ouvrir : sa fiche porte équiper, '
    + 'interdire et je l\'ai déjà.';
}

/**
 * Le filtre a poser apres un clic sur une bascule.
 *
 * Une seule liste se montre a la fois : cliquer une autre remplace, et
 * recliquer la meme releve le filtre.
 *
 * @param {string|null} pose Liste montree en ce moment.
 * @param {string} clique Liste que le doigt vient de toucher.
 * @returns {string|null}
 */
export function suivanteAvoir(pose, clique) {
  return pose === clique ? null : clique;
}
