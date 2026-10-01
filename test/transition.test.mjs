/**
 * Transition du stuff actuel vers un stuff cible.
 *
 * Le joueur connait le stuff qu'il vise ; il ne peut pas tout acheter d'un
 * coup. Il change donc son stuff par etapes, et chaque etape doit tenir ses
 * conditions (12 PA, 5 PM, 600 sagesse...) : un stuff intermediaire qui les
 * casse ne sert pas en combat. Acheter puis revendre une piece de passage
 * coute du temps et des kamas : la V1 n'en propose aucune. Une piece cible
 * peut s'acheter et dormir en banque avant d'etre equipee.
 *
 * Les regles que ces tests tiennent :
 * - une piece deja portee ou en banque coute zero ;
 * - sans le prix de chaque piece a acheter, le plan attend ;
 * - apres chaque etape, le stuff tient toutes ses conditions ;
 * - une etape tient le plus petit groupe de pieces qui garde les conditions ;
 * - le plus grand gain par kama passe en premier ;
 * - la derniere etape donne le stuff cible ;
 * - les kamas du joueur disent quoi equiper maintenant, et quoi mettre en
 *   banque quand l'etape suivante coute trop.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { planifierTransition } from '../src/solver/transition.mjs';
import { SEARCH_MODES } from '../src/solver/score.mjs';

const SORT_FEU = {
  name: 'Feu', apCost: 3, castsPerTurn: 1, baseCrit: 0,
  lines: [{ element: 'feu', min: 20, max: 20, critMin: 20, critMax: 20, source: 'sort', range: null }],
};

const piece = (id, fr, slot, stats, extra = {}) => Object.freeze({
  id, fr, slot, level: 1, stats: Object.freeze(stats), setId: null, typeFr: slot, ...extra,
});

// Stuff actuel.
const AMULETTE_PA = piece(1, 'Amulette PA', 'amulette', { pa: 1, intelligence: 50 });
const CAPE_FEU = piece(2, 'Cape feu', 'cape', { intelligence: 100 });
const COIFFE_FAIBLE = piece(3, 'Coiffe faible', 'chapeau', { intelligence: 20 });
const BOTTES_FAIBLES = piece(4, 'Bottes faibles', 'bottes', { intelligence: 20 });
const EPEE = piece(5, 'Epee', 'arme', { intelligence: 30 });
const BOUCLIER = piece(6, 'Bouclier', 'bouclier', { intelligence: 30 });

// Pieces du stuff cible.
const AMULETTE_FEU = piece(11, 'Amulette feu', 'amulette', { intelligence: 300 });
const CAPE_PA = piece(12, 'Cape PA', 'cape', { pa: 1, intelligence: 200 });
const COIFFE_FORTE = piece(13, 'Coiffe forte', 'chapeau', { intelligence: 400 });
const BOTTES_FORTES = piece(14, 'Bottes fortes', 'bottes', { intelligence: 60 });
const MARTEAU = piece(15, 'Marteau a deux mains', 'arme', { intelligence: 500 }, { twoHanded: true });

const SANS_CONDITION = Object.freeze({ mode: SEARCH_MODES.DAMAGE, conditions: [], spells: [SORT_FEU] });

/** Exactement 8 PA : 7 de base au niveau 100, et une seule piece PA. */
const HUIT_PA = Object.freeze({
  ...SANS_CONDITION,
  conditions: [{ stat: 'pa', target: 8, max: 8, absolute: true, weight: 100 }],
});

const contexte = (objective = SANS_CONDITION) => ({
  level: 100, allocation: {}, scrolls: {}, passives: null,
  profile: { classe: 5, sexe: 0 }, setById: new Map(), objective,
});

/** Les prix du marche, en kamas. */
const PRIX = new Map([
  [11, 2_000_000], [12, 1_000_000], [13, 500_000], [14, 3_000_000], [15, 4_000_000],
]);

const ids = (items) => items.map((item) => item.id).sort((a, b) => a - b);

/** Le stuff equipe apres chaque etape du plan. */
function stuffsDuPlan(actuel, etapes) {
  const stuffs = [];
  let porte = actuel;
  for (const etape of etapes) {
    const sortantes = new Set(etape.sortantes.map((item) => item.id));
    porte = [...porte.filter((item) => !sortantes.has(item.id)), ...etape.entrantes];
    stuffs.push(porte);
  }
  return stuffs;
}

test('une piece deja portee ou en banque coute zero', async (t) => {
  const actuel = [AMULETTE_PA, COIFFE_FAIBLE];
  const cible = [AMULETTE_PA, COIFFE_FORTE];

  await t.test('la piece portee ne fait pas d\'etape', () => {
    const plan = planifierTransition({ actuel, cible, prix: PRIX, contexte: contexte() });
    assert.equal(plan.etapes.length, 1);
    assert.deepEqual(ids(plan.etapes[0].entrantes), [13]);
  });

  await t.test('la piece en banque ne demande ni prix ni kamas', () => {
    const plan = planifierTransition({
      actuel, cible, prix: new Map(), possedees: new Set([13]), contexte: contexte(),
    });
    assert.deepEqual(plan.prixManquants, []);
    assert.equal(plan.etapes[0].cout, 0);
  });
});

test('sans le prix de chaque piece a acheter, le plan attend', () => {
  const plan = planifierTransition({
    actuel: [COIFFE_FAIBLE, BOTTES_FAIBLES],
    cible: [COIFFE_FORTE, BOTTES_FORTES],
    prix: new Map([[13, 500_000]]),
    contexte: contexte(),
  });
  assert.equal(plan.etapes, null);
  assert.deepEqual(ids(plan.prixManquants), [14]);
});

test('apres chaque etape, le stuff tient ses conditions', async (t) => {
  // Changer l'amulette seule tombe a 7 PA ; changer la cape seule monte a 9.
  const actuel = [AMULETTE_PA, CAPE_FEU, COIFFE_FAIBLE];
  const cible = [AMULETTE_FEU, CAPE_PA, COIFFE_FORTE];
  const plan = planifierTransition({ actuel, cible, prix: PRIX, contexte: contexte(HUIT_PA) });

  await t.test('l\'amulette et la cape changent ensemble', () => {
    const groupe = plan.etapes.find((etape) => etape.entrantes.some((item) => item.id === 11));
    assert.deepEqual(ids(groupe.entrantes), [11, 12]);
    assert.deepEqual(ids(groupe.sortantes), [1, 2]);
  });

  await t.test('la coiffe, libre de toute condition, fait son etape seule', () => {
    assert.equal(plan.etapes.length, 2);
    assert.ok(plan.etapes.some((etape) => ids(etape.entrantes).join() === '13'));
  });

  await t.test('chaque stuff intermediaire garde ses 8 PA', () => {
    for (const etape of plan.etapes) assert.equal(etape.valide, true);
  });
});

test('une arme a deux mains enleve le bouclier dans la meme etape', () => {
  const plan = planifierTransition({
    actuel: [EPEE, BOUCLIER], cible: [MARTEAU], prix: PRIX, contexte: contexte(),
  });
  assert.equal(plan.etapes.length, 1);
  assert.deepEqual(ids(plan.etapes[0].entrantes), [15]);
  assert.deepEqual(ids(plan.etapes[0].sortantes), [5, 6]);
  assert.equal(plan.etapes[0].cout, 4_000_000);
});

test('le plus grand gain par kama passe en premier', async (t) => {
  const actuel = [COIFFE_FAIBLE, BOTTES_FAIBLES, CAPE_FEU];
  const cible = [COIFFE_FORTE, BOTTES_FORTES, CAPE_PA];

  await t.test('la coiffe, forte et peu chere, avant les bottes', () => {
    const plan = planifierTransition({ actuel, cible, prix: PRIX, contexte: contexte() });
    const ordre = plan.etapes.map((etape) => etape.entrantes[0].id);
    assert.deepEqual(ordre, [13, 12, 14]);
  });

  await t.test('une piece deja en banque passe avant tout achat', () => {
    const plan = planifierTransition({
      actuel, cible, prix: PRIX, possedees: new Set([14]), contexte: contexte(),
    });
    assert.equal(plan.etapes[0].entrantes[0].id, 14);
  });

  await t.test('chaque etape dit son cout et son gain', () => {
    const plan = planifierTransition({ actuel, cible, prix: PRIX, contexte: contexte() });
    assert.equal(plan.etapes[0].cout, 500_000);
    assert.ok(plan.etapes.every((etape) => etape.gain > 0));
    assert.ok(plan.etapes[1].score > plan.etapes[0].score);
  });
});

test('la derniere etape donne le stuff cible', () => {
  const actuel = [AMULETTE_PA, CAPE_FEU, COIFFE_FAIBLE, BOTTES_FAIBLES];
  const cible = [AMULETTE_FEU, CAPE_PA, COIFFE_FORTE, BOTTES_FORTES];
  const plan = planifierTransition({ actuel, cible, prix: PRIX, contexte: contexte(HUIT_PA) });

  const stuffs = stuffsDuPlan(actuel, plan.etapes);
  assert.deepEqual(ids(stuffs.at(-1)), ids(cible));
  assert.equal(plan.coutTotal, 6_500_000);
});

test('un stuff actuel hors conditions trouve un plan quand meme', () => {
  // Sans piece PA, le stuff actuel reste a 7 PA : la premiere etape redresse.
  const actuel = [CAPE_FEU, COIFFE_FAIBLE];
  const cible = [CAPE_PA, COIFFE_FORTE];
  const plan = planifierTransition({ actuel, cible, prix: PRIX, contexte: contexte(HUIT_PA) });

  assert.equal(plan.depart.valide, false);
  assert.ok(plan.etapes.every((etape) => etape.valide));
  assert.deepEqual(ids(stuffsDuPlan(actuel, plan.etapes).at(-1)), ids(cible));
});

test('les kamas du joueur disent quoi faire maintenant', async (t) => {
  const actuel = [COIFFE_FAIBLE, BOTTES_FAIBLES, CAPE_FEU];
  const cible = [COIFFE_FORTE, BOTTES_FORTES, CAPE_PA];
  // Ordre du plan : coiffe (0,5 M), cape (1 M), bottes (3 M).

  await t.test('assez pour les deux premieres etapes', () => {
    const plan = planifierTransition({ actuel, cible, prix: PRIX, kamas: 2_000_000, contexte: contexte() });
    assert.equal(plan.maintenant.etapesPayables, 2);
    assert.equal(plan.maintenant.reste, 500_000);
    assert.equal(plan.maintenant.manque, 2_500_000);
  });

  await t.test('assez pour tout', () => {
    const plan = planifierTransition({ actuel, cible, prix: PRIX, kamas: 10_000_000, contexte: contexte() });
    assert.equal(plan.maintenant.etapesPayables, 3);
    assert.deepEqual(plan.maintenant.banque, []);
    assert.equal(plan.maintenant.manque, 0);
  });

  await t.test('pas assez pour un groupe : ses pieces vont en banque, la moins chere d\'abord', () => {
    const plan = planifierTransition({
      actuel: [AMULETTE_PA, CAPE_FEU],
      cible: [AMULETTE_FEU, CAPE_PA],
      prix: PRIX, kamas: 1_500_000, contexte: contexte(HUIT_PA),
    });
    assert.equal(plan.maintenant.etapesPayables, 0);
    assert.deepEqual(ids(plan.maintenant.banque), [12]);
    assert.equal(plan.maintenant.manque, 1_500_000);
  });
});

test('le plan ne touche pas aux listes recues', () => {
  const actuel = Object.freeze([AMULETTE_PA, CAPE_FEU]);
  const cible = Object.freeze([AMULETTE_FEU, CAPE_PA]);
  assert.doesNotThrow(() => planifierTransition({
    actuel, cible, prix: PRIX, possedees: new Set(), contexte: contexte(HUIT_PA),
  }));
  assert.deepEqual(ids(actuel), [1, 2]);
});
