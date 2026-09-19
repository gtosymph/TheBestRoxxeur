import assert from 'node:assert/strict';
import test from 'node:test';

import { patchImport } from '../web/import-stuff.mjs';

const ITEMS = new Map([
  [1, { id: 1, slot: 'chapeau' }], [2, { id: 2, slot: 'anneau' }], [3, { id: 3, slot: 'anneau' }],
  [4, { id: 4, slot: 'anneau' }], [5, { id: 5, slot: 'artefact' }],
]);
const ETAT = { verrous: new Set([1, 9]), allocation: { force: 10, chance: 0 }, scrolls: { force: false } };
const DATE = new Date('2026-09-20T00:00:00Z');

test('patchImport : les pieces deviennent le stuff porte, pose a la main, ET la reference', () => {
  const patch = patchImport(ETAT, { itemIds: [1, 2, 3, 5] }, ITEMS, DATE);
  assert.deepEqual([...patch.equipped.entries()].map(([c, p]) => [c, p.id]),
    [['chapeau:0', 1], ['anneau:0', 2], ['anneau:1', 3], ['artefact:0', 5]]);
  assert.deepEqual([...patch.posees], ['chapeau:0', 'anneau:0', 'anneau:1', 'artefact:0']);
  assert.deepEqual(patch.reference, { itemIds: [1, 2, 3, 5], date: DATE.toISOString() });
  assert.deepEqual(patch.paliers, []);
  assert.deepEqual([...patch.verrous], [1], 'un verrou sur une piece absente tombe');
});

test('patchImport : une troisieme bague et un identifiant inconnu sont ignores et comptes', () => {
  const patch = patchImport(ETAT, { itemIds: [2, 3, 4, 77] }, ITEMS, DATE);
  assert.equal(patch.equipped.size, 2);
  assert.deepEqual(patch.laisses, [4, 77]);
});

test('patchImport : niveau, points et parchemins suivent quand le lien les porte', () => {
  const patch = patchImport(ETAT, { itemIds: [1], niveau: 150, allocation: { chance: 200 }, scrolls: { force: true } }, ITEMS, DATE);
  assert.equal(patch.niveau, 150);
  assert.deepEqual(patch.allocation, { force: 10, chance: 200 });
  assert.deepEqual(patch.scrolls, { force: true });
  const sans = patchImport(ETAT, { itemIds: [1] }, ITEMS, DATE);
  assert.equal('niveau' in sans, false);
  assert.equal('allocation' in sans, false);
});

test('patchImport : sans piece connue, rien n\'est propose', () => {
  assert.equal(patchImport(ETAT, { itemIds: [77] }, ITEMS, DATE), null);
});
