/**
 * Les pieces de passage.
 *
 * Quand l'etape suivante coute plus que les kamas du joueur, il a deux
 * chemins : acheter les pieces cibles une par une et les garder en banque, ou
 * progresser tout de suite avec une piece de passage. Cette piece se jette a
 * la fin : son prix est perdu. Elle doit donc garder les conditions et
 * rapporter du score, sinon elle ne vaut rien.
 *
 * Les regles que ces tests tiennent :
 * - seules les cases de l'etape suivante se cherchent ;
 * - la piece se pose sur le stuff porte maintenant, garde les conditions et
 *   augmente le score ;
 * - ni piece cible, ni piece interdite, ni piece hors niveau ;
 * - trois candidates par case au plus, une piece en banque d'abord, puis par
 *   gain ;
 * - un prix donne le gain par kama ; une piece plus chere que le reste se
 *   montre quand meme, avec sa marque.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { piecesDePassage } from '../src/solver/passage.mjs';
import { stuffApres } from '../src/solver/transition.mjs';
import { SEARCH_MODES } from '../src/solver/score.mjs';

const SORT_FEU = {
  name: 'Feu', apCost: 3, castsPerTurn: 1, baseCrit: 0,
  lines: [{ element: 'feu', min: 20, max: 20, critMin: 20, critMax: 20, source: 'sort', range: null }],
};

const piece = (id, fr, slot, stats, extra = {}) => Object.freeze({
  id, fr, slot, level: 1, stats: Object.freeze(stats), setId: null, typeFr: slot, ...extra,
});

// Le stuff porte maintenant.
const AMULETTE_PA = piece(1, 'Amulette PA', 'amulette', { pa: 1, intelligence: 50 });
const CAPE_FEU = piece(2, 'Cape feu', 'cape', { intelligence: 100 });
const COIFFE_FAIBLE = piece(3, 'Coiffe faible', 'chapeau', { intelligence: 20 });

// Les pieces cibles.
const COIFFE_FORTE = piece(13, 'Coiffe forte', 'chapeau', { intelligence: 400 });
const BOTTES_FORTES = piece(14, 'Bottes fortes', 'bottes', { intelligence: 60 });

// Les pieces du catalogue.
const COIFFE_BRUTE = piece(28, 'Coiffe brute', 'chapeau', { intelligence: 200 });
const COIFFE_MOYENNE = piece(21, 'Coiffe moyenne', 'chapeau', { intelligence: 150 });
const COIFFE_DOUCE = piece(26, 'Coiffe douce', 'chapeau', { intelligence: 100 });
const COIFFE_TENDRE = piece(27, 'Coiffe tendre', 'chapeau', { intelligence: 60 });
const COIFFE_PA = piece(22, 'Coiffe PA', 'chapeau', { pa: 1, intelligence: 300 });
const COIFFE_HAUTE = piece(23, 'Coiffe haute', 'chapeau', { intelligence: 900 }, { level: 150 });
const COIFFE_INTERDITE = piece(24, 'Coiffe interdite', 'chapeau', { intelligence: 800 });
const COIFFE_NULLE = piece(25, 'Coiffe nulle', 'chapeau', { prospection: 30 });
const CAPE_FORTE = piece(29, 'Cape forte', 'cape', { intelligence: 500 });
const BOTTES_MOYENNES = piece(30, 'Bottes moyennes', 'bottes', { intelligence: 40 });

const CATALOGUE = Object.freeze([
  AMULETTE_PA, CAPE_FEU, COIFFE_FAIBLE, COIFFE_FORTE, BOTTES_FORTES,
  COIFFE_BRUTE, COIFFE_MOYENNE, COIFFE_DOUCE, COIFFE_TENDRE, COIFFE_PA,
  COIFFE_HAUTE, COIFFE_INTERDITE, COIFFE_NULLE, CAPE_FORTE, BOTTES_MOYENNES,
]);

/** Exactement 8 PA : 7 de base au niveau 100, et une seule piece PA. */
const HUIT_PA = Object.freeze({
  mode: SEARCH_MODES.DAMAGE, spells: [SORT_FEU],
  conditions: [{ stat: 'pa', target: 8, max: 8, absolute: true, weight: 100 }],
});

const CONTEXTE = Object.freeze({
  level: 100, allocation: {}, scrolls: {}, passives: null,
  profile: { classe: 5, sexe: 0 }, setById: new Map(), objective: HUIT_PA,
});

const PORTE = Object.freeze([AMULETTE_PA, CAPE_FEU, COIFFE_FAIBLE]);
const CIBLE = Object.freeze([AMULETTE_PA, CAPE_FEU, COIFFE_FORTE, BOTTES_FORTES]);

/** L'etape suivante du plan : la coiffe forte, trop chere pour l'instant. */
const ETAPE_COIFFE = Object.freeze({ entrantes: [COIFFE_FORTE], sortantes: [COIFFE_FAIBLE] });

const chercher = (champs = {}) => piecesDePassage({
  porte: PORTE, etape: ETAPE_COIFFE, cible: CIBLE, catalogue: CATALOGUE,
  bannis: new Set([24]), possedees: new Set(), prix: new Map(), reste: 0,
  contexte: CONTEXTE, ...champs,
});

const idsDe = (candidates) => candidates.map((c) => c.item.id);

test('seules les cases de l\'etape suivante se cherchent', () => {
  const { parCase } = chercher();
  assert.deepEqual(parCase.map((c) => c.slot), ['chapeau']);
});

test('trois candidates au plus, du plus gros gain au plus petit', () => {
  const [chapeau] = chercher().parCase;
  assert.deepEqual(idsDe(chapeau.candidates), [28, 21, 26]);
  assert.ok(chapeau.candidates[0].gain > chapeau.candidates[1].gain);
});

test('une candidate garde les conditions, et rapporte du score', async (t) => {
  const ids = idsDe(chercher({ parCaseMax: 20 }).parCase[0].candidates);

  await t.test('la coiffe PA monterait a 9 PA', () => assert.ok(!ids.includes(22)));
  await t.test('la coiffe nulle ne rapporte rien', () => assert.ok(!ids.includes(25)));
  await t.test('la piece cible n\'est pas une piece de passage', () => assert.ok(!ids.includes(13)));
  await t.test('la piece interdite reste dehors', () => assert.ok(!ids.includes(24)));
  await t.test('la piece hors niveau reste dehors', () => assert.ok(!ids.includes(23)));
  await t.test('la piece deja portee ne se propose pas', () => assert.ok(!ids.includes(3)));
});

test('une candidate dit quelle piece elle remplace', () => {
  const [chapeau] = chercher().parCase;
  assert.equal(chapeau.candidates[0].remplace, COIFFE_FAIBLE);
});

test('une case vide se remplit, sans rien remplacer', () => {
  const { parCase } = chercher({
    etape: { entrantes: [BOTTES_FORTES], sortantes: [] },
  });
  assert.deepEqual(parCase.map((c) => c.slot), ['bottes']);
  assert.deepEqual(idsDe(parCase[0].candidates), [30]);
  assert.equal(parCase[0].candidates[0].remplace, null);
});

test('une piece en banque passe d\'abord, et ne coute rien', () => {
  const [chapeau] = chercher({ possedees: new Set([27]) }).parCase;
  assert.deepEqual(idsDe(chapeau.candidates), [27, 28, 21]);
  assert.equal(chapeau.candidates[0].enBanque, true);
  assert.equal(chapeau.candidates[0].cout, 0);
});

test('un prix donne le gain par kama, et marque la piece trop chere', async (t) => {
  const prix = new Map([[28, 400_000], [21, 100_000]]);
  const [chapeau] = chercher({ prix, reste: 300_000 }).parCase;
  const [brute, moyenne, douce] = chapeau.candidates;

  await t.test('plus chere que le reste : visible, et marquee', () => {
    assert.equal(brute.tropChere, true);
    assert.equal(brute.gainParKama, brute.gain / 400_000);
  });
  await t.test('dans le reste : payable', () => {
    assert.equal(moyenne.tropChere, false);
    assert.equal(moyenne.cout, 100_000);
  });
  await t.test('sans prix : ni cout ni gain par kama', () => {
    assert.equal(douce.cout, null);
    assert.equal(douce.gainParKama, null);
    assert.equal(douce.tropChere, false);
  });
});

test('sans piece qui convienne, la recherche le dit', () => {
  const { parCase, aucune } = chercher({ catalogue: [COIFFE_FAIBLE, COIFFE_FORTE, COIFFE_PA] });
  assert.equal(aucune, true);
  assert.deepEqual(parCase, []);
});

test('stuffApres donne le stuff porte apres les etapes payees', () => {
  const etapes = [
    { entrantes: [COIFFE_FORTE], sortantes: [COIFFE_FAIBLE] },
    { entrantes: [BOTTES_FORTES], sortantes: [] },
  ];
  const ids = (items) => items.map((item) => item.id).sort((a, b) => a - b);
  assert.deepEqual(ids(stuffApres(PORTE, etapes, 0)), [1, 2, 3]);
  assert.deepEqual(ids(stuffApres(PORTE, etapes, 1)), [1, 2, 13]);
  assert.deepEqual(ids(stuffApres(PORTE, etapes, 2)), [1, 2, 13, 14]);
});
