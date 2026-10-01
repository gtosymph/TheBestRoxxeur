/**
 * Quand la feuille de transition a un sens.
 *
 * Elle part du stuff fige comme celui porte en jeu, et va vers le stuff pose a
 * l'ecran. Sans stuff fige, ou quand les deux sont le meme, il n'y a rien a
 * planifier : le bouton reste cache.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { transitionPossible } from '../web/v2/transition.mjs';

const pose = (...ids) => new Map(ids.map((id, rang) => [`case${rang}`, { id }]));

test('transitionPossible', async (t) => {
  await t.test('sans stuff fige, rien a planifier', () => {
    assert.equal(transitionPossible({ reference: null, equipped: pose(1, 2) }), false);
  });

  await t.test('sans stuff pose, rien a planifier', () => {
    assert.equal(transitionPossible({ reference: { itemIds: [1] }, equipped: new Map() }), false);
  });

  await t.test('le meme stuff, meme range autrement, ne se planifie pas', () => {
    assert.equal(transitionPossible({ reference: { itemIds: [2, 1] }, equipped: pose(1, 2) }), false);
  });

  await t.test('deux stuffs differents se planifient', () => {
    assert.equal(transitionPossible({ reference: { itemIds: [1, 3] }, equipped: pose(1, 2) }), true);
  });
});
