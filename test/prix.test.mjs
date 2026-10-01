/**
 * Les prix que le joueur entre a la main.
 *
 * L'HDV bouge chaque jour : un prix vaut avec sa date. Le joueur tape les
 * kamas comme il les lit en jeu (« 1 500 000 », « 1,5m », « 800k ») ; une
 * saisie absurde se refuse au lieu de fausser le plan de transition.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JOURS_AVANT_PEREMPTION, lireKamas, lireTablePrix, poserPrix, prixDuPlan, prixPerime,
} from '../src/data/prix.mjs';

const JOUR = 24 * 60 * 60 * 1000;
const MAINTENANT = Date.UTC(2026, 9, 1);

test('lireKamas lit les kamas comme le joueur les ecrit', async (t) => {
  await t.test('un nombre, avec ou sans espaces', () => {
    assert.equal(lireKamas(1500000), 1_500_000);
    assert.equal(lireKamas('1 500 000'), 1_500_000);
    assert.equal(lireKamas('1 500 000'), 1_500_000);
    assert.equal(lireKamas('0'), 0);
  });

  await t.test('les suffixes k et m, avec un point ou une virgule', () => {
    assert.equal(lireKamas('800k'), 800_000);
    assert.equal(lireKamas('1,5m'), 1_500_000);
    assert.equal(lireKamas('2.25 M'), 2_250_000);
  });

  await t.test('une saisie absurde rend null', () => {
    for (const brut of ['', '  ', 'abc', '-5', '1..5m', null, undefined, Number.NaN, -1]) {
      assert.equal(lireKamas(brut), null, String(brut));
    }
  });
});

test('poserPrix garde le prix avec sa date, sans toucher la table recue', () => {
  const vide = Object.freeze({});
  const table = poserPrix(vide, 13, 500_000, MAINTENANT);
  assert.deepEqual(table, { 13: { kamas: 500_000, date: MAINTENANT } });
  assert.deepEqual(vide, {});

  const sans = poserPrix(table, 13, null, MAINTENANT);
  assert.deepEqual(sans, {});
  assert.ok(table[13], 'la table recue garde son prix');
});

test('prixPerime signale un prix de plus de sept jours', () => {
  assert.equal(JOURS_AVANT_PEREMPTION, 7);
  assert.equal(prixPerime({ kamas: 1, date: MAINTENANT - 6 * JOUR }, MAINTENANT), false);
  assert.equal(prixPerime({ kamas: 1, date: MAINTENANT - 8 * JOUR }, MAINTENANT), true);
  assert.equal(prixPerime({ kamas: 1 }, MAINTENANT), true, 'sans date, le prix est suspect');
  assert.equal(prixPerime(null, MAINTENANT), false, 'sans prix, rien a signaler');
});

test('lireTablePrix garde les entrees saines d\'un rangement abime', () => {
  const brut = {
    13: { kamas: 500_000, date: MAINTENANT },
    14: { kamas: -3, date: MAINTENANT },
    abc: { kamas: 10, date: MAINTENANT },
    15: 'n\'importe quoi',
    16: { kamas: 20 },
  };
  assert.deepEqual(lireTablePrix(brut), {
    13: { kamas: 500_000, date: MAINTENANT },
    16: { kamas: 20, date: 0 },
  });
  assert.deepEqual(lireTablePrix(null), {});
  assert.deepEqual(lireTablePrix([1, 2]), {});
});

test('prixDuPlan donne la table que le plan de transition lit', () => {
  const table = { 13: { kamas: 500_000, date: MAINTENANT }, 14: { kamas: 0, date: MAINTENANT } };
  assert.deepEqual([...prixDuPlan(table)], [[13, 500_000], [14, 0]]);
});
