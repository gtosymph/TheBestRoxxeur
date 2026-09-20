/**
 * Comparer plusieurs stuffs, sans en faire une page.
 *
 * Un tableau qui montre tout ne compare rien : sur trente-sept mesures, deux
 * stuffs proches en partagent trente. Les lignes identiques occupent l'ecran
 * et noient les cinq qui decident. La comparaison les masque donc, et dit
 * combien elle en a masquees — sans ce compte, le joueur ne saurait pas s'il
 * regarde un extrait ou le tout.
 *
 * Deux lectures cohabitent, et le choix ne tient pas au gout :
 *
 *   - un minimum se lit en VALEUR ABSOLUE. Ce qui compte est s'il est tenu,
 *     pas s'il a monte de trois ;
 *   - tout le reste se lit en ECART face au stuff porte. Un joueur ne compare
 *     pas deux fiches, il compare ce qu'il gagne et ce qu'il perd.
 */
import { SLOTS } from '../../src/data/slots.mjs';
import { STAT_LABELS } from '../../src/data/stats.mjs';
import { EXOS_RARES } from '../../src/engine/exos.mjs';
import { LIBELLE_EXO } from '../exos-piece.mjs';

/**
 * Les lignes d'une comparaison.
 *
 * @param {{cle: string, libelle: string}[]} mesures Mesures a comparer, en ordre.
 * @param {{nom: string, stats: Record<string, number>}[]} colonnes
 *   Les stuffs compares. La PREMIERE est la reference des ecarts.
 * @param {object} [options]
 * @param {Set<string>} [options.minimums] Mesures lues en valeur absolue.
 * @param {boolean} [options.masquerIdentiques] Vrai par defaut.
 * @returns {{lignes: any[], masquees: number}}
 */
export function lignesComparaison(mesures, colonnes, options = {}) {
  const { minimums = new Set(), masquerIdentiques = true } = options;
  if (colonnes.length === 0) return { lignes: [], masquees: 0 };

  const reference = colonnes[0];

  const toutes = mesures.map((mesure) => {
    const valeurs = colonnes.map((c) => Number(c.stats?.[mesure.cle]) || 0);
    const absolue = minimums.has(mesure.cle);
    const base = Number(reference.stats?.[mesure.cle]) || 0;

    return {
      cle: mesure.cle,
      libelle: mesure.libelle,
      // La famille voyage avec la ligne : le tableau la regroupe a l'affichage.
      // Quarante mesures a la file se lisent comme un mur ; les memes, rangees
      // sous « Dommages » et « Resistances », se parcourent.
      famille: mesure.famille ?? null,
      absolue,
      cellules: valeurs.map((valeur, i) => ({
        valeur,
        // La colonne de reference n'a pas d'ecart avec elle-meme : montrer
        // « +0 » y ferait croire a une mesure qui n'a pas bouge.
        ecart: absolue || i === 0 ? null : valeur - base,
      })),
      // Une mesure identique partout n'aide pas a choisir.
      varie: new Set(valeurs).size > 1,
    };
  });

  const gardees = masquerIdentiques ? toutes.filter((l) => l.varie) : toutes;
  return { lignes: gardees, masquees: toutes.length - gardees.length };
}

/**
 * Les lignes gardees, rangees par famille.
 *
 * Une famille dont toutes les lignes ont ete masquees disparait : un intitule
 * seul se lit comme un defaut d'affichage. Les lignes sans famille se
 * regroupent sous un groupe anonyme, en tete, plutot que de disparaitre.
 *
 * @param {{famille: string|null}[]} lignes
 * @returns {{famille: string|null, lignes: any[]}[]}
 */
export function grouperParFamille(lignes) {
  const groupes = [];
  for (const ligne of lignes) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.famille === (ligne.famille ?? null)) dernier.lignes.push(ligne);
    else groupes.push({ famille: ligne.famille ?? null, lignes: [ligne] });
  }
  return groupes;
}

/**
 * Nom court d'un stuff dans la comparaison.
 *
 * Les colonnes sont etroites : « Stuff trouve numero 3 » ne tient pas, et
 * « 3 » ne dit pas ce qu'on regarde. Le rang suffit, avec le stuff porte
 * nomme pour ce qu'il est.
 *
 * @param {number} rang Zero pour le stuff porte.
 */
export const nomDeColonne = (rang) => (rang === 0 ? 'Porte' : `Trouvé ${rang}`);

/** Famille sous laquelle les degats se rangent dans le tableau. */
export const FAMILLE_DEGATS = 'Dégâts';

/**
 * Les mesures de degats : le total, puis chaque sort choisi, puis l'arme.
 *
 * Elles passent AVANT les caracteristiques : un joueur qui compare deux
 * stuffs veut d'abord savoir lequel frappe le plus, et sur quel sort.
 *
 * @param {{name?: string}[]} sorts Sorts choisis dans les reglages.
 * @param {boolean} avecArme Vrai quand l'attaque de l'arme compte.
 * @returns {{cle: string, libelle: string, famille: string}[]}
 */
export function mesuresDegats(sorts, avecArme) {
  return [
    { cle: 'degats', libelle: 'Dégâts par tour', famille: FAMILLE_DEGATS },
    ...(sorts ?? []).map((sort, i) => ({
      cle: `sort:${i}`, libelle: sort.name ?? `Sort ${i + 1}`, famille: FAMILLE_DEGATS,
    })),
    ...(avecArme ? [{ cle: 'arme', libelle: 'Arme', famille: FAMILLE_DEGATS }] : []),
  ];
}

/**
 * Les valeurs de ces mesures, lues dans le detail rendu par `damageValue`.
 *
 * Le detail range l'attaque de l'arme APRES les sorts, comme
 * `attaquesAffichees` la place.
 *
 * @param {{total: number, perSpell: {average: number, repeats?: number}[]}|null} detail
 * @param {number} nbSorts
 * @param {boolean} avecArme
 * @returns {Record<string, number>}
 */
export function valeursDegats(detail, nbSorts, avecArme) {
  const parTour = (coup) => (coup ? (Number(coup.average) || 0) * (Number(coup.repeats) > 0 ? Number(coup.repeats) : 1) : 0);
  const coups = detail?.perSpell ?? [];
  const valeurs = { degats: Number(detail?.total) || 0 };
  for (let i = 0; i < nbSorts; i += 1) valeurs[`sort:${i}`] = parTour(coups[i]);
  if (avecArme) valeurs.arme = parTour(coups[nbSorts]);
  return valeurs;
}

/** Ordre des cases sur le plateau, par emplacement. */
const RANG_CASE = new Map(SLOTS.map((slot, i) => [slot.key, i]));

/**
 * Les pieces d'une colonne, dans l'ordre du plateau.
 *
 * Deux stuffs qui se lisent dans le meme ordre se comparent d'un coup d'oeil :
 * l'amulette sous l'amulette, les bottes sous les bottes.
 *
 * @param {{slot?: string}[]|null} pieces
 */
export function ordonnerPieces(pieces) {
  return [...(pieces ?? [])].sort((a, b) =>
    (RANG_CASE.get(a.slot) ?? 99) - (RANG_CASE.get(b.slot) ?? 99));
}

/** Nom court de la case d'une piece, pour dire ou l'exo se pose. */
const NOM_CASE = new Map(SLOTS.map((s) => [s.key, s.label]));

/** « +30 » ou « -2 » : le signe se lit toujours. */
const signe = (n) => (n < 0 ? `\u2212${Math.abs(n)}` : `+${n}`);

/**
 * Ce que la forgemagie ajoute a une colonne, une ligne par exo.
 *
 * L'ordre suit les pieces, donc le plateau : le joueur lit « Exo PA, Ceinture »
 * sous la ceinture qu'il voit dans la ligne des pieces. Un over
 * (« Vitalite +30 ») se lit avant l'exo rare de la meme piece, comme sur la
 * fiche. Une piece hors de la colonne ne compte pas, meme si la table garde
 * encore ses exos.
 *
 * @param {Record<string, any>|null} exos Table des exos par piece.
 * @param {{id: number, slot?: string}[]|null} pieces Pieces de la colonne, ordonnees.
 * @returns {string[]}
 */
export function libellesExos(exos, pieces) {
  return (pieces ?? []).flatMap((piece) => {
    const exo = exos?.[piece.id];
    if (!exo) return [];
    const ou = NOM_CASE.get(piece.slot) ?? piece.slot ?? '';
    const overs = Object.entries(exo.over ?? {})
      .filter(([, v]) => Number.isFinite(Number(v)) && Number(v) !== 0)
      .map(([stat, v]) => `${STAT_LABELS[stat] ?? stat} ${signe(Number(v))} \u00b7 ${ou}`);
    const rares = EXOS_RARES.filter((cle) => exo[cle])
      .map((cle) => `Exo ${LIBELLE_EXO[cle]} \u00b7 ${ou}`);
    return [...overs, ...rares];
  });
}

/**
 * Ce que la forgemagie ajoute a une colonne, table normalisee en entree.
 *
 * Cette table dit des LIGNES, pas des gestes : « intelligence : 101 » ou
 * « pa : 1 ». Elle reunit ce que le joueur a pose et ce que le moteur a
 * decide, et c'est bien ce qu'il faut lire — le joueur veut savoir ce que la
 * piece porte au-dela de son jet, pas qui l'a demande.
 *
 * @param {Map<number, Record<string, number>>|null} table Exos par piece.
 * @param {{id: number, slot?: string}[]|null} pieces Pieces de la colonne, ordonnees.
 * @returns {string[]}
 */
export function libellesForge(table, pieces) {
  return (pieces ?? []).flatMap((piece) => {
    const lignes = table?.get?.(piece.id);
    if (!lignes) return [];
    const ou = NOM_CASE.get(piece.slot) ?? piece.slot ?? '';

    const rares = [];
    const overs = [];
    for (const [stat, valeur] of Object.entries(lignes)) {
      if (!valeur) continue;
      if (EXOS_RARES.includes(stat)) rares.push(`Exo ${LIBELLE_EXO[stat]} \u00b7 ${ou}`);
      else overs.push(`${STAT_LABELS[stat] ?? stat} ${signe(Number(valeur))} \u00b7 ${ou}`);
    }
    return [...overs, ...rares];
  });
}
