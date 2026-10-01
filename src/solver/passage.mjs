/**
 * Les pieces de passage.
 *
 * Quand l'etape suivante du plan coute plus que les kamas du joueur, il peut
 * attendre (acheter les pieces cibles une par une, et les garder en banque),
 * ou progresser tout de suite avec une piece de passage. Cette piece se jette
 * quand la piece cible de sa case arrive : son prix est perdu. Elle ne se
 * propose donc que si elle garde les conditions ET rapporte du score.
 *
 * La recherche ne touche que les cases de l'etape suivante : une piece de
 * passage ailleurs serait un nouvel achat, pas un pont vers le stuff cible.
 */
import { estObtenable } from '../data/criteria.mjs';
import { jugerStuff } from './transition.mjs';

/** Candidates montrees par case. */
export const CANDIDATES_PAR_CASE = 3;

/**
 * Les pieces de passage pour les cases de l'etape suivante.
 *
 * @param {object} demande
 * @param {any[]} demande.porte Stuff porte maintenant, etapes payees comprises.
 * @param {{entrantes: any[], sortantes: any[]}} demande.etape Etape trop chere.
 * @param {any[]} demande.cible Stuff vise : ses pieces ne sont pas de passage.
 * @param {any[]} demande.catalogue
 * @param {Set<number>} [demande.bannis]
 * @param {Set<number>} [demande.possedees] Pieces en banque : gratuites.
 * @param {Map<number, number>} [demande.prix]
 * @param {number} [demande.reste] Kamas libres apres les etapes payees.
 * @param {object} demande.contexte Comme pour le moteur.
 * @param {number} [demande.parCaseMax]
 * @returns {{parCase: {slot: string, candidates: any[]}[], aucune: boolean}}
 */
export function piecesDePassage({
  porte, etape, cible, catalogue, bannis = new Set(), possedees = new Set(), prix = new Map(),
  reste = 0, contexte, parCaseMax = CANDIDATES_PAR_CASE,
}) {
  const base = jugerStuff(porte, contexte).score;
  const exclus = new Set([...cible, ...porte].map((item) => item.id));
  const slots = [...new Set(etape.entrantes.map((item) => item.slot))];

  const parCase = slots
    .map((slot) => {
      const remplace = etape.sortantes.find((item) => item.slot === slot) ?? null;
      const autres = porte.filter((item) => item !== remplace);
      const candidates = catalogue
        .filter((item) => item.slot === slot && item.level <= contexte.level
          && !exclus.has(item.id) && !bannis.has(item.id) && estObtenable(item))
        .map((item) => ({ item, ...jugerStuff([...autres, item], contexte) }))
        .filter(({ valide, score }) => valide && score > base)
        .map(({ item, score }) => fiche(item, remplace, score - base, { possedees, prix, reste }))
        .sort((a, b) => Number(b.enBanque) - Number(a.enBanque) || b.gain - a.gain)
        .slice(0, parCaseMax);
      return { slot, candidates };
    })
    .filter(({ candidates }) => candidates.length > 0);

  return { parCase, aucune: parCase.length === 0 };
}

/** Ce que le joueur lit d'une candidate : son gain, son prix, et s'il peut la payer. */
function fiche(item, remplace, gain, { possedees, prix, reste }) {
  const enBanque = possedees.has(item.id);
  const cout = enBanque ? 0 : (prix.get(item.id) ?? null);
  let gainParKama = null;
  if (cout === 0) gainParKama = Infinity;
  else if (cout !== null) gainParKama = gain / cout;
  return { item, remplace, gain, cout, gainParKama, enBanque, tropChere: cout !== null && cout > reste };
}
