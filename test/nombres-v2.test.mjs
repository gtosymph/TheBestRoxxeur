import test from 'node:test';
import assert from 'node:assert/strict';

import { facteur, nombre } from '../web/v2/nombres.mjs';

test('les nombres de l ecran', async (t) => {
  await t.test('une mesure s arrondit et prend l espace des milliers', () => {
    assert.equal(nombre(12345.6).replace(/\s/g, ' '), '12 346');
  });

  await t.test('un multiplicateur garde deux decimales et la virgule', () => {
    assert.equal(facteur(9.19), '9,19');
    assert.equal(facteur(2), '2,00');
  });
});
