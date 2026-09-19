/**
 * La forgemagie : ce qu'une piece porte AU-DELA de ses lignes du catalogue.
 *
 * Deux choses distinctes se cachent sous le mot « exo » :
 *
 *   - l'exo RARE : un point de PA, de PM ou de portee ajoute a une piece qui
 *     n'en a pas. Le jeu n'en tolere qu'un par piece, et il plafonne le total
 *     du personnage : 12 PA, 6 PM, 6 de portee. Il se compte en millions de
 *     kamas, ce qui en fait une decision et non un detail ;
 *   - l'OVER : une ligne ordinaire poussee au-dela du jet parfait, vitalite,
 *     force, resistance. Le moteur prend deja le jet parfait de chaque ligne,
 *     l'over ne fait qu'ajouter ce que le forgemage a obtenu de plus.
 *
 * Le joueur pose les siens, piece par piece. Le solveur peut en placer aussi,
 * sous un budget : « au plus un exo PA ». Il ne place que des exos rares — un
 * over ne se devine pas — et il les pose la ou ils rapportent, sur une piece
 * qui n'a ni la ligne native ni un autre exo rare.
 *
 * Les exos se lisent PAR PIECE, jamais par case : un exo suit la piece qu'il
 * habille, dans les essais gardes, dans le partage, dans la reference.
 */

/** Les trois exos rares, dans l'ordre ou l'ecran les montre. */
export const EXOS_RARES = Object.freeze(['pa', 'pm', 'po']);

/** Ce que le jeu accepte au plus sur un personnage, exos compris. */
export const PLAFONDS = Object.freeze({ pa: 12, pm: 6, po: 6 });

/**
 * Les lignes qu'une forgemagie ajoute a une piece.
 *
 * @param {{pa?: number, pm?: number, po?: number, over?: Record<string, number>}|null} exo
 * @returns {Record<string, number>} Sans zero : une ligne a zero n'existe pas.
 */
export function statsExo(exo) {
  if (!exo) return {};
  const stats = {};
  for (const cle of EXOS_RARES) {
    if (exo[cle]) stats[cle] = 1;
  }
  for (const [cle, valeur] of Object.entries(exo.over ?? {})) {
    const nombre = Number(valeur);
    if (Number.isFinite(nombre) && nombre !== 0) stats[cle] = (stats[cle] ?? 0) + nombre;
  }
  return stats;
}

/**
 * La configuration du joueur, mise a la forme que le moteur lit.
 *
 * @param {Record<string|number, any>|null|undefined} config Exos par identifiant de piece.
 * @param {Set<string>} connues Cles de statistiques acceptees.
 * @returns {Map<number, Record<string, number>>} Apport par piece, sans piece vide.
 */
export function normaliserExos(config, connues) {
  const exos = new Map();
  if (!config || typeof config !== 'object') return exos;

  for (const [brut, exo] of Object.entries(config)) {
    const id = Number(brut);
    if (!Number.isInteger(id)) continue;
    const stats = Object.fromEntries(
      Object.entries(statsExo(exo)).filter(([cle]) => connues.has(cle)),
    );
    if (Object.keys(stats).length > 0) exos.set(id, stats);
  }
  return exos;
}

/** Vrai quand la piece porte deja un exo rare, pose par le joueur. */
function porteUnExoRare(exo) {
  return EXOS_RARES.some((cle) => exo?.[cle]);
}

/**
 * Pose les exos libres du solveur sur les pieces d'un build.
 *
 * Un exo de PA vaut un PA quelle que soit la piece : le choix de la piece ne
 * change rien au score, seulement au conseil rendu. La regle du jeu tranche :
 * une piece sans la ligne native, et sans autre exo rare. Le plafond du
 * personnage borne le nombre pose — un treizieme PA n'existe pas, il ne se
 * paie pas non plus.
 *
 * @param {object} entree
 * @param {any[]} entree.items Pieces du build.
 * @param {Record<string, number>} entree.raw Statistiques brutes, exos du joueur compris.
 * @param {Record<string, number>} entree.bases Valeur de depart du personnage par mesure.
 * @param {Record<string, number>|null} entree.budget Exos permis par mesure.
 * @param {Map<number, Record<string, number>>|null} entree.exos Exos poses par le joueur.
 * @returns {{raw: Record<string, number>, places: {id: number, cle: string}[]}}
 *   `raw` est l'entree elle-meme quand rien ne se pose.
 */
export function placerExos({ items, raw, bases, budget, exos }) {
  if (!budget) return { raw, places: [] };

  const places = [];
  const prises = new Set();
  let sortie = raw;

  for (const cle of EXOS_RARES) {
    const permis = Math.max(0, Math.trunc(Number(budget[cle]) || 0));
    if (permis === 0) continue;
    const marge = PLAFONDS[cle] - ((bases[cle] ?? 0) + (raw[cle] ?? 0));
    let restant = Math.min(permis, marge);

    for (const item of items) {
      if (restant <= 0) break;
      if (!item || prises.has(item.id)) continue;
      if (item.stats?.[cle]) continue;
      if (porteUnExoRare(exos?.get(item.id))) continue;
      prises.add(item.id);
      places.push({ id: item.id, cle });
      restant -= 1;
    }

    const poses = places.filter((p) => p.cle === cle).length;
    if (poses > 0) sortie = { ...sortie, [cle]: (sortie[cle] ?? 0) + poses };
  }

  return { raw: sortie, places };
}
