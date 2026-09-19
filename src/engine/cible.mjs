/**
 * La cible : ce que le stuff frappe.
 *
 * Jusqu'ici le score comptait les degats contre zero pour cent de
 * resistance. C'est faux pour tout ce qui se combat vraiment : un boss a
 * trente ou quarante pour cent dans ses elements forts, et un stuff bati pour
 * frapper la n'est pas le meme que pour frapper dans le vide.
 *
 * La cible se pose de deux facons, et la seconde l'emporte :
 *
 *   - `manuel` : cinq pourcentages, un par element, poses a la main ;
 *   - `monstres` : des monstres choisis dans le bestiaire, chacun a un grade.
 *     Quand il y en a, la resistance par element est LA MOYENNE des
 *     monstres choisis — un joueur qui vise trois adversaires veut un stuff
 *     qui frappe correctement les trois, pas le pire.
 *
 * Un monstre garde ici sa fiche entiere (nom, grade, niveau, resistances) :
 * l'etat se relit sans le bestiaire, qui pese six cents kilo-octets et ne se
 * charge que quand le joueur ouvre la liste.
 */
import { ELEMENTS } from '../data/stats.mjs';

/** Zero partout : ce que le moteur applique quand rien n'est pose. */
export const SANS_RESISTANCE = Object.freeze(
  Object.fromEntries(ELEMENTS.map((element) => [element, 0])),
);

/** Cible d'un joueur qui n'a rien pose. */
export const CIBLE_VIDE = Object.freeze({
  manuel: SANS_RESISTANCE,
  monstres: Object.freeze([]),
});

/** Un pourcentage lisible, ou zero. */
function pourcent(brut) {
  const n = Number(brut);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Cinq resistances lisibles, dans l'ordre des elements. */
function resistances(brut) {
  if (!brut || typeof brut !== 'object') return null;
  if (!ELEMENTS.every((element) => Number.isFinite(Number(brut[element])))) return null;
  return Object.fromEntries(ELEMENTS.map((element) => [element, pourcent(brut[element])]));
}

/**
 * Un monstre choisi, tel qu'il se garde : rien de plus que ce qui sert.
 * @param {any} brut
 */
function monstre(brut) {
  if (!brut || typeof brut !== 'object') return null;
  const res = resistances(brut.res);
  if (!res || !Number.isFinite(Number(brut.id))) return null;
  return {
    id: Number(brut.id),
    nom: typeof brut.nom === 'string' ? brut.nom : '',
    grade: Math.max(1, pourcent(brut.grade) || 1),
    niveau: Math.max(0, pourcent(brut.niveau)),
    res,
  };
}

/**
 * Une cible propre, quoi qu'on lui donne.
 *
 * Le champ `manuel` accepte une table partielle : un joueur qui pose 25 % de
 * feu ne dit rien des quatre autres, qui restent a zero.
 *
 * @param {any} brut
 * @returns {{manuel: Record<string, number>, monstres: any[]}}
 */
export function normaliserCible(brut) {
  if (!brut || typeof brut !== 'object') return CIBLE_VIDE;

  const manuelBrut = brut.manuel && typeof brut.manuel === 'object' ? brut.manuel : {};
  const manuel = Object.fromEntries(ELEMENTS.map((element) => {
    const n = Number(manuelBrut[element]);
    return [element, Number.isFinite(n) ? Math.trunc(n) : 0];
  }));
  const monstres = Array.isArray(brut.monstres) ? brut.monstres.map(monstre).filter(Boolean) : [];

  const cible = { manuel, monstres };
  return estVide(cible) ? CIBLE_VIDE : cible;
}

/**
 * Vrai quand la cible ne change rien au calcul.
 * @param {{manuel: Record<string, number>, monstres: any[]}} cible
 */
export function estVide(cible) {
  return cible.monstres.length === 0
    && ELEMENTS.every((element) => (cible.manuel[element] ?? 0) === 0);
}

/**
 * Les cinq resistances que le moteur applique.
 *
 * La moyenne s'arrondit a l'entier le plus proche : le jeu ne connait que
 * des pourcentages entiers, et une decimale ferait croire a une precision
 * que la moyenne de deux monstres n'a pas.
 *
 * @param {{manuel: Record<string, number>, monstres: any[]}} cible
 * @returns {Record<string, number>}
 */
export function resistancesCible(cible) {
  if (cible.monstres.length === 0) return { ...cible.manuel };
  const n = cible.monstres.length;
  return Object.fromEntries(ELEMENTS.map((element) => [
    element,
    Math.round(cible.monstres.reduce((somme, m) => somme + m.res[element], 0) / n),
  ]));
}
