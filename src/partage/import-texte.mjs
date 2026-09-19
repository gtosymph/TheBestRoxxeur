/**
 * Reconnaissance de noms d'objets dans un texte colle.
 *
 * Sur une page Dofusbook, le joueur selectionne la liste des objets et la
 * colle. Chaque ligne est un nom, parfois suivi du niveau ou d'une quantite.
 * Le nom se compare sans casse ni accents : une majuscule ou un « E » a la
 * place d'un « É » ne doivent pas faire perdre une piece.
 *
 * Rien n'est devine. Une ligne qui ne correspond a aucun nom du catalogue
 * revient telle quelle, pour etre montree au joueur avant de poser quoi que
 * ce soit.
 */

/** Forme comparable d'un nom : minuscules, sans accents, espaces reduits. */
export function normaliserNom(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ce qui suit un nom sur une ligne collee : niveau, quantite, puces. */
const QUEUE = /\s*(\(|-|–|·|x\s*\d+\s*$|niv(eau)?\.?\s*\d+|lvl\.?\s*\d+|\d+\s*$).*$/i;
const TETE = /^\s*([-*•·]|\d+\s*[x×]\s*)\s*/i;

/** Le nom porte par une ligne, debarrasse de ce qui l'entoure. */
function nomDe(ligne) {
  const sansTete = ligne.replace(TETE, '');
  const sansQueue = sansTete.replace(QUEUE, '');
  // Un nom qui finit par un nombre (« Dofus 2 ») perdrait ce nombre : la
  // forme brute est essayee d'abord, la forme nettoyee ensuite.
  return [normaliserNom(sansTete), normaliserNom(sansQueue)].filter(Boolean);
}

/**
 * Les objets du catalogue nommes dans un texte.
 *
 * @param {string} texte Une ligne par objet.
 * @param {{id: number, fr: string}[]} items Le catalogue.
 * @returns {{trouves: {ligne: string, item: any}[], inconnues: string[]}}
 *   Les lignes sans nom (vides, nombres seuls, puces seules) ne comptent
 *   nulle part.
 */
export function reconnaitreNoms(texte, items) {
  const parNom = new Map();
  for (const item of items ?? []) {
    const nom = normaliserNom(item?.fr);
    if (nom && !parNom.has(nom)) parNom.set(nom, item);
  }

  const trouves = [];
  const inconnues = [];
  for (const brute of String(texte ?? '').split(/\r?\n/)) {
    const ligne = brute.trim();
    const candidats = nomDe(ligne);
    if (candidats.length === 0 || !/[a-z]/i.test(candidats[0])) continue;

    const item = candidats.map((nom) => parNom.get(nom)).find(Boolean);
    if (item) trouves.push({ ligne, item });
    else inconnues.push(ligne);
  }
  return { trouves, inconnues };
}
