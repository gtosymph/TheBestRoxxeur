import test from 'node:test';
import assert from 'node:assert/strict';

import { loadCatalog } from '../src/data/catalog-node.mjs';
import { buildPools, randomGenome, decode } from '../src/solver/genome.mjs';
import { createEvaluator, createRandom, solve } from '../src/solver/genetic.mjs';
import { SEARCH_MODES } from '../src/solver/score.mjs';
import { EXOS_RARES } from '../src/engine/exos.mjs';

const NIVEAU = 190;
const catalogue = await loadCatalog();
const { layout, pools } = buildPools(catalogue.items, { level: NIVEAU });

const SORT = {
  name: 'Test Feu', apCost: 3, castsPerTurn: 4, baseCrit: 10,
  lines: [{ element: 'feu', min: 30, max: 34, critMin: 36, critMax: 40, source: 'sort', range: 'melee' }],
};

function evaluateur(exosLibres, exos = null) {
  return createEvaluator({
    pools, setById: catalogue.setById, level: NIVEAU, porteur: { allocation: {} },
    scrolls: {}, passives: null, profile: {}, exos,
    objective: { mode: SEARCH_MODES.DAMAGE, conditions: [], spells: [SORT], exosLibres },
  });
}

test('solveur : le budget d exos libres se lit dans le resultat complet', () => {
  const genome = randomGenome(layout, pools, createRandom(3));
  const sans = evaluateur(null).complet(genome);
  const avec = evaluateur({ pa: 1, pm: 1, po: 0 }).complet(genome);

  assert.deepEqual(sans.exos, []);
  assert.equal(avec.exos.length, 2, 'un exo PA et un exo PM poses');
  assert.ok(avec.exos.every((p) => EXOS_RARES.includes(p.cle)));

  const portes = new Set(decode(genome, pools).map((i) => i.id));
  assert.ok(avec.exos.every((p) => portes.has(p.id)), 'les exos vont sur des pieces du build');
  assert.ok(avec.stats.pa >= sans.stats.pa + 1 || sans.stats.pa === 12);
  assert.ok(avec.score >= sans.score, 'un PA de plus ne fait jamais baisser les degats');
});

test('solveur : l exo du joueur suit la piece dans l evaluation', () => {
  const genome = randomGenome(layout, pools, createRandom(5));
  const piece = decode(genome, pools).find((i) => !i.stats?.pm);
  const exos = new Map([[piece.id, { pm: 1 }]]);
  const sans = evaluateur(null).complet(genome);
  const avec = evaluateur(null, exos).complet(genome);
  assert.equal(avec.stats.pm, Math.min(6, sans.stats.pm + 1));
});

test('solveur : les candidats et le gagnant portent leurs exos poses', () => {
  const objective = { mode: SEARCH_MODES.DAMAGE, conditions: [], spells: [SORT], exosLibres: { pa: 1, pm: 0, po: 0 } };
  const result = solve({
    items: catalogue.items, setById: catalogue.setById, level: NIVEAU, objective,
    allocation: {}, scrolls: {}, passives: null, profile: {},
    lockedIds: [], banned: new Set(), allowedSlots: null, seedGenomes: [], seedItems: [],
  }, { populationSize: 30, maxGenerations: 10, stagnationLimit: Infinity, seed: 7 });

  assert.ok(Array.isArray(result.exos), 'le gagnant dit ses exos');
  assert.ok(result.candidats.length > 0);
  for (const candidat of result.candidats) {
    assert.ok(Array.isArray(candidat.exos), 'chaque candidat dit ses exos');
  }
});
