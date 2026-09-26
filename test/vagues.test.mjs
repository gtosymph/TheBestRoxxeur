import test from 'node:test';
import assert from 'node:assert/strict';

import { fusionnerPaliers, optionsDeVague, parCle } from '../web/vagues.mjs';

test('fusionnerPaliers garde le meilleur palier de chaque cle', () => {
  const gardes = new Map([[1, { changements: 1, score: 10 }]]);
  fusionnerPaliers(gardes, [
    { changements: 1, score: 8 },
    { changements: 1, score: 12 },
    { changements: 2, score: 5 },
  ], { cle: 'changements', valeur: 'score' });
  assert.deepEqual([...gardes.values()], [
    { changements: 1, score: 12 },
    { changements: 2, score: 5 },
  ]);
});

test('fusionnerPaliers accepte une liste absente', () => {
  const gardes = new Map();
  fusionnerPaliers(gardes, undefined, { cle: 'tranche', valeur: 'damage' });
  assert.equal(gardes.size, 0);
});

test('parCle rend les paliers tries par leur cle', () => {
  const gardes = new Map([[3, { tranche: 3 }], [1, { tranche: 1 }], [2, { tranche: 2 }]]);
  assert.deepEqual(parCle(gardes, 'tranche').map((p) => p.tranche), [1, 2, 3]);
});

test('optionsDeVague borne la vague et garde les options du joueur', () => {
  const options = optionsDeVague({ mutationRate: 0.2 }, 4_294_967_297);
  assert.equal(options.mutationRate, 0.2);
  assert.equal(options.maxGenerations, 20);
  assert.equal(options.stagnationLimit, Number.POSITIVE_INFINITY);
  assert.equal(options.optimiserPoints, true);
  // La graine reste un entier non signe sur 32 bits.
  assert.equal(options.seed, 1);
});
