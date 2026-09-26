import test from 'node:test';
import assert from 'node:assert/strict';

import { raccourci } from '../web/v2/raccourci.mjs';

test('un raccourci s\'ecrit comme la machine le dit', async (t) => {
  await t.test('sur un Mac, avec la touche Commande', () => {
    assert.equal(raccourci('K', 'MacIntel'), '⌘K');
    assert.equal(raccourci('Z', 'iPad'), '⌘Z');
  });

  await t.test('ailleurs, avec Ctrl', () => {
    assert.equal(raccourci('K', 'Win32'), 'Ctrl K');
    assert.equal(raccourci('Z', 'Linux x86_64'), 'Ctrl Z');
  });
});
