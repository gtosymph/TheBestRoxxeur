/**
 * Fonction de score du solveur.
 *
 * Le score suit un ordre lexicographique, mesure par essais controles :
 *   - s'il reste des conditions non satisfaites, le score vaut l'oppose de la
 *     somme des penalites, donc un nombre negatif ;
 *   - si toutes les conditions sont satisfaites, le score vaut les degats totaux.
 *
 * Un build qui respecte toutes les conditions bat donc toujours un build qui
 * en manque une. Un depassement d'objectif n'apporte aucun bonus.
 *
 * En mode caracteristiques, sans aucun sort, la regle change : le score somme
 * les ecarts signes, ponderes par le poids. Un depassement rapporte alors,
 * et le maximum tronque la valeur comptee.
 *
 * Les deux modes ont ete mesures par essais controles sur une valeur de 54 :
 *   - objectif 10, poids 1, sans maximum -> 44 ;
 *   - objectif 10, poids 2, sans maximum -> 88 ;
 *   - objectif 10, poids 2, maximum 30   -> 40, donc valeur tronquee a 30.
 *
 * En mode degats au contraire, un depassement ne rapporte rien et le maximum
 * n'entre pas dans le score : il n'y sert que de contrainte de recherche,
 * signalee au solveur par maxViolations.
 */
import { computeSpell } from '../engine/damage.mjs';
import { optimiserCombo } from './combo.mjs';
import { conditionValue, STAT_DEGATS } from './condition-value.mjs';

/** Modes de recherche proposes par le solveur. */
export const SEARCH_MODES = Object.freeze({
  DAMAGE: 'degats',
  STATS: 'caracteristiques',
  /**
   * Maximiser les points de vie effectifs.
   *
   * Les roles s'echangent : l'endurance devient le score, les degats
   * deviennent une condition (STAT_DEGATS). L'ordre lexicographique ne bouge
   * pas — un build qui manque une condition reste sous tous les autres.
   */
  ENDURANCE: 'endurance',
  /**
   * Maximiser les deux a la fois, dans la proportion voulue.
   *
   * Les deux modes purs posent une question tranchee. Un joueur reel veut
   * frapper ET tenir, dans une proportion qui depend de ce qu'il joue. La
   * part des degats (`objective.partDegats`) est le seul reglage, et les
   * deux modes purs en sont les bornes exactes.
   */
  MIXTE: 'mixte',
  /**
   * Maximiser la vitesse a laquelle le personnage monte.
   *
   * L'XP d'un combat se multiplie par 1 + sagesse / 100. Le nombre de combats
   * par heure, lui, depend de la vitesse a tuer, donc des degats. Ce que le
   * joueur gagne dans une heure vaut le PRODUIT des deux.
   *
   * Le produit n'est pas un detail de forme : il dit que tuer deux fois plus
   * vite vaut exactement autant que doubler le multiplicateur. Une somme
   * ponderee aurait demande un curseur, et ce curseur n'aurait repondu a
   * aucune question — il n'existe pas de « bonne » proportion entre les deux,
   * seulement leur produit.
   */
  XP: 'xp',
});

/**
 * Ce par quoi la sagesse multiplie l'XP d'un combat.
 *
 * C'est le seul des deux nombres qui se lise seul : « x 9,19 » se compare a
 * ce que le joueur connait de son personnage, alors que la vitesse d'XP n'est
 * qu'un produit sans unite, bon a classer des stuffs et a rien d'autre.
 *
 * Les autres bonus d'XP — etoiles de la zone, challenges, idoles, almanax —
 * s'ajoutent a la sagesse DANS la meme parenthese : 1 + (sagesse + bonus) / 100.
 * Ils ne viennent pas du stuff, c'est le joueur qui les dit.
 *
 * @param {number} sagesse
 * @param {number} [bonus] Bonus d'XP hors sagesse, en pourcents.
 * @returns {number} Multiplicateur, jamais sous 1.
 */
export function multiplicateurXp(sagesse, bonus = 0) {
  return 1 + (positif(sagesse) + normaliserBonusXp(bonus)) / 100;
}

/** Plafond du bonus hors sagesse : au-dela, la saisie est une faute de frappe. */
export const BONUS_XP_MAX = 1000;

/** Un nombre, ramene a zero s'il est absent, negatif ou illisible. */
const positif = (n) => Math.max(0, Number(n) || 0);

/**
 * Le bonus d'XP hors sagesse, tel que le calcul le lit.
 *
 * @param {unknown} bonus
 * @returns {number} Entier entre 0 et BONUS_XP_MAX.
 */
export function normaliserBonusXp(bonus) {
  return Math.min(BONUS_XP_MAX, Math.round(positif(bonus)));
}

/**
 * Ce que le personnage gagne par heure, a un facteur pres.
 *
 * La sagesse multiplie l'XP de chaque combat ; les degats decident du nombre
 * de combats. Sans degats, rien ne meurt et aucune sagesse ne fait monter :
 * le produit le dit tout seul.
 *
 * Ce nombre classe les stuffs, il ne se LIT pas : il n'a pas d'unite. Ce que
 * l'ecran montre au joueur, c'est le multiplicateur.
 *
 * Le bonus hors sagesse n'est pas un facteur constant : il se range dans la
 * meme parenthese que la sagesse. Plus il pese, moins la sagesse du stuff
 * compte face aux degats, et le stuff qui gagne peut changer.
 *
 * @param {number} degats Degats par tour.
 * @param {number} sagesse
 * @param {number} [bonus] Bonus d'XP hors sagesse, en pourcents.
 * @returns {number}
 */
export function vitesseXp(degats, sagesse, bonus = 0) {
  return degats * multiplicateurXp(sagesse, bonus);
}

/** Part des degats quand le joueur n'a rien regle : les deux a parts egales. */
export const PART_EQUILIBRE = 0.5;

/**
 * Part des degats, bornee entre zero et un.
 * @param {unknown} brut
 * @returns {number}
 */
export function normaliserPart(brut) {
  // Le curseur de l'interface rend une chaine : elle se lit. Mais « null » et
  // la chaine vide valent zero pour Number, ce qui ferait passer un reglage
  // absent pour un mode endurance pur.
  if (brut === null || brut === undefined || brut === '') return PART_EQUILIBRE;

  const part = Number(brut);
  if (!Number.isFinite(part)) return PART_EQUILIBRE;
  return Math.min(1, Math.max(0, part));
}

/**
 * Score mixte : moyenne geometrique ponderee des deux mesures.
 *
 *     score = degats^a * endurance^(1 - a)
 *
 * Cette forme, et pas une somme ponderee, pour trois raisons :
 *
 *   1. Les bornes sont exactement les deux modes purs : a = 1 rend les degats,
 *      a = 0 rend l'endurance. Le mixte est le cas general, pas un mode a part.
 *   2. Multiplier une mesure par une constante multiplie TOUS les scores par
 *      la meme constante : le classement ne bouge pas. Une somme ponderee, au
 *      contraire, exige de regler une echelle entre deux mesures qui n'ont ni
 *      la meme unite ni le meme ordre de grandeur — 4722 degats contre 3692
 *      pdv effectifs sur un build, 4011 contre 5989 sur un autre.
 *   3. Le poids agit donc sur des POURCENTAGES : a parts egales, le solveur
 *      lache un pour cent de degats pour gagner un pour cent d'endurance.
 *
 * A parts egales, le carre du score vaut degats x endurance : divise par le
 * coup de reference, c'est le nombre de tours tenus multiplie par les degats
 * par tour, donc les degats infliges avant de tomber.
 *
 * @param {number} degats
 * @param {number} endurance Points de vie effectifs.
 * @param {number} part Part des degats, entre zero et un.
 * @returns {number}
 */
export function scoreMixte(degats, endurance, part) {
  // Une mesure qui ne compte pas ne doit pas annuler le score : a part nulle,
  // un build sans degat reste juge sur sa seule endurance.
  if (part >= 1) return Math.max(0, degats);
  if (part <= 0) return Math.max(0, endurance);

  const d = Math.max(0, degats);
  const e = Math.max(0, endurance);
  // Un build qui ne frappe pas ne vaut rien, quelle que soit sa resistance,
  // et reciproquement : le produit le dit tout seul.
  if (d === 0 || e === 0) return 0;

  // Le score s'evalue des centaines de milliers de fois par recherche, et une
  // exponentiation coute cher. Deux reecritures la rendent tenable :
  //   - a parts egales, une racine remplace les deux puissances ;
  //   - sinon, d^a * e^(1-a) s'ecrit e * (d/e)^a, une seule puissance au lieu
  //     de deux. Mesure : 39 ns par appel contre 67, pour un ecart relatif de
  //     deux dix-millioniemes de milliardieme, soit la precision machine.
  if (part === PART_EQUILIBRE) return Math.sqrt(d * e);
  return e * ((d / e) ** part);
}

/**
 * Ce qu'un pour cent de degats laches coute en pour cent d'endurance.
 *
 * C'est la pente de la courbe d'indifference du score mixte. Elle se montre
 * au joueur : le reglage ne dit rien tant qu'on ne sait pas ce qu'il echange.
 *
 * @param {number} part Part des degats, entre zero et un.
 * @returns {number}
 */
export function tauxDechange(part) {
  if (part >= 1) return Infinity;
  return part / (1 - part);
}

export { STAT_DEGATS };

/** Valeur sentinelle utilisee pour "pas de maximum". */
export const NO_MAX = 32767;

/**
 * Normalise une condition saisie par l'utilisateur.
 * @param {object} condition
 * @returns {{stat: string, target: number, weight: number, max: number, absolute: boolean}}
 */
export function normalizeCondition(condition) {
  if (!condition || typeof condition.stat !== 'string') {
    throw new Error('Condition invalide : la statistique visee est absente.');
  }

  const target = Number(condition.target ?? 0);
  const weight = Number(condition.weight ?? 1);

  const rawMax = condition.max;
  const parsedMax = rawMax == null || rawMax === '' ? Infinity : Number(rawMax);
  const max = !Number.isFinite(parsedMax) || parsedMax >= NO_MAX ? Infinity : parsedMax;

  if (!Number.isFinite(target)) throw new Error(`Objectif invalide pour "${condition.stat}".`);
  if (!Number.isFinite(weight) || weight < 0) {
    throw new Error(`Poids invalide pour "${condition.stat}".`);
  }

  return {
    stat: condition.stat,
    target,
    weight,
    max,
    absolute: Boolean(condition.absolute),
  };
}

/**
 * Conditions deja normalisees, gardees par tableau d'origine.
 *
 * L'objectif ne bouge pas pendant une recherche, mais le score se calcule des
 * centaines de milliers de fois : normaliser a chaque appel refaisait le meme
 * travail et allouait un objet par condition.
 *
 * ATTENTION : le cache tient sur l'identite du tableau. Ne modifiez jamais un
 * tableau de conditions en place ; construisez-en un nouveau.
 */
const CONDITIONS_NORMALISEES = new WeakMap();

/**
 * Normalise une liste de conditions, une seule fois par liste.
 * @param {any[]} conditions
 * @returns {ReturnType<typeof normalizeCondition>[]}
 */
export function normalizeConditions(conditions) {
  const connu = CONDITIONS_NORMALISEES.get(conditions);
  if (connu) return connu;

  const normalisees = conditions.map(normalizeCondition);
  CONDITIONS_NORMALISEES.set(conditions, normalisees);
  return normalisees;
}

/**
 * Evalue une condition sur un build.
 * @param {{stat: string, target: number, weight: number, max: number, absolute: boolean}} condition
 * @param {Record<string, number>} stats
 * @param {number} [degats] Degats totaux du build.
 * @returns {{met: boolean, missing: number, penalty: number, value: number}}
 */
export function evaluateCondition(condition, stats, degats = 0) {
  const value = conditionValue(condition.stat, stats, degats);
  const missing = Math.max(0, condition.target - value);

  return { met: missing === 0, missing, penalty: missing * condition.weight, value };
}

/**
 * Degats totaux d'un build, toutes attaques confondues.
 * @param {any[]} spells
 * @param {Record<string, number>} stats
 * @param {Record<string, number>|null} [resistances] Resistances de la cible
 *   par element (voir src/engine/cible.mjs). Absentes : la cible ne resiste
 *   a rien.
 * @returns {{total: number, perSpell: any[]}}
 */
export function damageValue(spells, stats, resistances = null) {
  let total = 0;
  const perSpell = [];

  for (const spell of spells) {
    const result = computeSpell(spell, stats, resistances);
    // L'attaque d'une arme compte ses utilisations par tour ; un sort
    // compte un seul lancer, comme dans le calcul de reference.
    const repeats = Number(spell.repeats) > 0 ? Number(spell.repeats) : 1;
    total += result.average * repeats;
    perSpell.push({ name: spell.name ?? '', repeats, ...result });
  }

  return { total, perSpell };
}

/**
 * Calcule le score complet d'un build.
 *
 * @param {Record<string, number>} stats Statistiques derivees du build.
 * @param {object} objective
 * @param {any[]} objective.conditions
 * @param {any[]} [objective.spells]
 * @param {string} [objective.mode]
 * @param {Record<string, number>} [objective.cible] Resistances de la cible
 *   par element. Elles reduisent chaque coup ; le reste du score ne bouge pas.
 * @param {{details?: boolean}} [options] details : mettre faux dans la boucle
 *   du solveur, qui ne lit que le score. Le detail par condition coute un
 *   objet par condition et par evaluation, pour rien.
 * @returns {{score: number, penalty: number, damage: number, satisfied: boolean, unmet: any[], details: any[]}}
 */
export function scoreBuild(stats, objective, options = {}) {
  const { conditions, spells = [], mode = SEARCH_MODES.DAMAGE, cible = null } = objective;
  const avecDetails = options.details !== false;
  const normalisees = normalizeConditions(conditions);
  let penalty = 0;
  const unmet = [];
  const details = [];

  // Les degats se calculent AVANT les conditions : une condition peut porter
  // sur eux. Le mode caracteristiques ne lance aucun sort et n'en a pas
  // besoin.
  const combo = mode === SEARCH_MODES.STATS ? null : objectiveCombo(objective, stats, spells);
  const damage = mode === SEARCH_MODES.STATS
    ? 0
    : (combo ? combo.total : damageValue(spells, stats, cible).total);

  for (const condition of normalisees) {
    const result = evaluateCondition(condition, stats, damage);

    penalty += result.penalty;
    if (avecDetails) details.push({ stat: condition.stat, weight: condition.weight, ...result });
    if (!result.met) {
      unmet.push({ stat: condition.stat, missing: result.missing, weight: condition.weight });
    }
  }

  const satisfied = penalty === 0;

  // Mode caracteristiques : la somme ponderee des depassements mesure le build.
  if (mode === SEARCH_MODES.STATS) {
    let somme = 0;
    for (const condition of normalisees) {
      const brut = conditionValue(condition.stat, stats, damage);
      // Le maximum tronque la valeur : il evite de sur-investir sans rien
      // bloquer. Place sous l'objectif il se contredirait lui-meme, et
      // rendrait negative la somme d'un build pourtant satisfait : il ne
      // descend donc jamais sous l'objectif.
      const plafond = Math.max(condition.max, condition.target);
      const retenue = Number.isFinite(plafond) ? Math.min(brut, plafond) : brut;
      somme += (retenue - condition.target) * condition.weight;
    }

    // Meme ordre lexicographique qu'en mode degats : la somme ne departage
    // que des builds qui tiennent toutes leurs conditions. Sans cela, un
    // depassement paie un manque — six cents points de Chance en trop
    // effacent le point de portee absent — et le solveur rend un build qui
    // ne respecte pas ce qui lui a ete demande.
    return {
      score: satisfied ? somme : -penalty,
      penalty, damage: 0, weighted: somme, satisfied, unmet, details,
    };
  }

  // Mode endurance : le build le plus resistant gagne, tant qu'il tient ses
  // conditions — dont, en general, un plancher de degats.
  if (mode === SEARCH_MODES.ENDURANCE) {
    const endurance = stats.pdvEffectifs ?? stats.pdv ?? 0;
    return {
      score: satisfied ? endurance : -penalty,
      penalty,
      damage,
      endurance,
      ...(combo ? { combo } : {}),
      satisfied,
      unmet,
      details,
    };
  }

  // Mode « Monter » : la vitesse a laquelle le personnage gagne de l'XP.
  if (mode === SEARCH_MODES.XP) {
    const sagesse = stats.sagesse ?? 0;
    const xp = vitesseXp(damage, sagesse, objective.bonusXp);
    return {
      score: satisfied ? xp : -penalty,
      penalty,
      damage,
      sagesse,
      xp,
      ...(combo ? { combo } : {}),
      satisfied,
      unmet,
      details,
    };
  }

  // Mode mixte : les deux mesures comptent, dans la proportion demandee.
  if (mode === SEARCH_MODES.MIXTE) {
    const endurance = stats.pdvEffectifs ?? stats.pdv ?? 0;
    const part = normaliserPart(objective.partDegats);

    return {
      score: satisfied ? scoreMixte(damage, endurance, part) : -penalty,
      penalty,
      damage,
      endurance,
      part,
      ...(combo ? { combo } : {}),
      satisfied,
      unmet,
      details,
    };
  }

  // Le score retient les degats : le combo optimise sous le budget de PA du
  // build quand il est actif, la somme simple des sorts sinon.
  return {
    score: satisfied ? damage : -penalty,
    penalty,
    damage,
    ...(combo ? { combo } : {}),
    satisfied,
    unmet,
    details,
  };
}

/**
 * Optimise le combo si l'objectif le demande.
 * @param {object} objective
 * @param {Record<string, number>} stats
 * @param {any[]} spells
 * @returns {ReturnType<typeof optimiserCombo> | null}
 */
function objectiveCombo(objective, stats, spells) {
  const reglage = objective?.combo;
  if (!reglage?.actif) return null;

  const reserve = Number.isFinite(reglage.reserve) ? Math.max(0, reglage.reserve) : 0;

  return optimiserCombo(spells, stats, {
    paBudget: (stats.pa ?? 0) - reserve,
    telefrag: reglage.telefrag !== false,
    elementsMin: Number(reglage.elementsMin) || 0,
    unLancer: Boolean(reglage.unLancer),
    cibleTelefrag: Boolean(reglage.cibleTelefrag),
    resistances: objective.cible ?? null,
  });
}

/**
 * Liste les conditions dont le maximum absolu est depasse.
 *
 * Le solveur ne doit pas proposer un tel build : le maximum absolu decrit une
 * limite que l'equipement ne peut pas franchir.
 *
 * @param {any[]} conditions
 * @param {Record<string, number>} stats
 * @param {number} [degats] Degats totaux du build.
 * @returns {{stat: string, value: number, max: number}[]}
 */
export function maxViolations(conditions, stats, degats = 0) {
  const violations = [];

  for (const condition of normalizeConditions(conditions)) {
    if (!condition.absolute || !Number.isFinite(condition.max)) continue;

    const value = conditionValue(condition.stat, stats, degats);
    if (value > condition.max) violations.push({ stat: condition.stat, value, max: condition.max });
  }

  return violations;
}

export { conditionValue };
