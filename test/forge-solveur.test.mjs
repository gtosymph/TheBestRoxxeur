/**
 * La forgemagie automatique, vue du solveur.
 *
 * Les tests unitaires disent que le choix d'une ligne est juste. Ceux-ci
 * disent que le choix arrive VRAIMENT jusqu'au score : un stuff forge doit
 * frapper plus fort que le meme stuff nu, et le mode eteint ne doit rien
 * changer du tout — c'est la garantie qui protege toutes les recherches qui ne
 * le demandent pas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { loadCatalog } from '../src/data/catalog-node.mjs';
import { buildPools, decode, randomGenome } from '../src/solver/genome.mjs';
import { createRandom, preparerRecherche } from '../src/solver/genetic.mjs';
import { SEARCH_MODES } from '../src/solver/score.mjs';
import { BUDGET_POIDS } from '../src/engine/runes.mjs';
import { valeursForge } from '../src/solver/forge-valeurs.mjs';

const NIVEAU = 190;
const catalogue = await loadCatalog();
const { layout, pools } = buildPools(catalogue.items, { level: NIVEAU });

const SORT = {
  name: 'Test Feu',
  apCost: 3,
  castsPerTurn: 4,
  baseCrit: 10,
  lines: [{ element: 'feu', min: 30, max: 34, critMin: 36, critMax: 40, source: 'sort', range: 'melee' }],
};

const OBJECTIF = Object.freeze({
  mode: SEARCH_MODES.DAMAGE, conditions: [], spells: [SORT], cible: null,
});

/** L'objectif, avec ou sans le mode forgemagie. */
function objectifForge(budget) {
  const valeurs = valeursForge({
    raw: { intelligence: 600, vitalite: 2000 }, level: NIVEAU, objective: OBJECTIF, budget,
  });
  return { ...OBJECTIF, forge: { budget, valeurs } };
}

/** Prepare une recherche et rend l'evaluation d'un genome fixe. */
function evaluer(objective, exos = null) {
  const { evaluate } = preparerRecherche({
    items: catalogue.items, setById: catalogue.setById, level: NIVEAU, objective,
    allocation: {}, scrolls: {}, passives: null, profile: {}, exos,
    lockedIds: [], banned: new Set(), allowedSlots: null,
  });
  const genome = randomGenome(layout, pools, createRandom(11));
  return { detail: evaluate.complet(genome), pieces: decode(genome, pools) };
}

test('solveur : le mode eteint ne change rien', () => {
  const nu = evaluer(OBJECTIF).detail;
  const eteint = evaluer({ ...OBJECTIF, forge: null }).detail;
  assert.equal(eteint.score, nu.score);
  assert.deepEqual(eteint.stats, nu.stats);
});

test('solveur : le mode allume fait monter le score du meme stuff', () => {
  const nu = evaluer(OBJECTIF).detail;
  const forge = evaluer(objectifForge(BUDGET_POIDS)).detail;

  assert.ok(forge.score > nu.score,
    `le stuff forge doit frapper plus fort : ${forge.score} contre ${nu.score}`);
});

test('solveur : la ligne poussee est celle que l objectif paie', () => {
  const { detail: nu } = evaluer(OBJECTIF);
  const { detail: forge, pieces } = evaluer(objectifForge(BUDGET_POIDS));

  // Le sort est de feu : l'intelligence monte, la chance ne bouge pas.
  const porteuses = pieces.filter((piece) => (piece.stats?.intelligence ?? 0) > 0).length;
  assert.ok(porteuses > 0, 'le stuff tire doit porter au moins une ligne d intelligence');
  assert.equal(forge.stats.intelligence, nu.stats.intelligence + porteuses * 101);
  assert.equal(forge.stats.chance, nu.stats.chance);
});

test('solveur : un budget reduit forge moins', () => {
  const { detail: large, pieces } = evaluer(objectifForge(BUDGET_POIDS));
  const { detail: serre } = evaluer(objectifForge(20));

  const porteuses = pieces.filter((piece) => (piece.stats?.intelligence ?? 0) > 0).length;
  assert.equal(serre.stats.intelligence, large.stats.intelligence - porteuses * (101 - 20));
  assert.ok(serre.score < large.score);
});

test('solveur : l exo du joueur mange le budget de sa piece', () => {
  const { pieces } = evaluer(objectifForge(BUDGET_POIDS));
  const porteuse = pieces.find((piece) => (piece.stats?.intelligence ?? 0) > 0 && !piece.stats?.pa);
  assert.ok(porteuse, 'il faut une piece a intelligence sans PA natif');

  const exos = new Map([[porteuse.id, { pa: 1 }]]);
  const { detail: sansExo } = evaluer(objectifForge(BUDGET_POIDS));
  const { detail: avecExo } = evaluer(objectifForge(BUDGET_POIDS), exos);

  // L'exo PA pese cent : la piece ne peut plus porter qu'un point d'over.
  assert.equal(avecExo.stats.intelligence, sansExo.stats.intelligence - 100);
  assert.equal(avecExo.stats.pa, Math.min(12, sansExo.stats.pa + 1));
});
