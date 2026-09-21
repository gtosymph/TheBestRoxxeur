/**
 * Le nombre de lancers que le JOUEUR choisit.
 *
 * Le sort porte deux nombres qui se ressemblent et ne disent pas la meme
 * chose : `castsPerTurn` est la limite du jeu, elle ne se discute pas ;
 * `repeats` est ce que le total compte, et c'est un choix. Sans reglage, le
 * total comptait un lancer par sort pendant que la fiche annoncait « 2
 * lancers par tour », et les deux chiffres se contredisaient a l'ecran.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { avecLancers, lancersDe, limiteDe } from '../web/lancers.mjs';

const PENDULE = { id: 13294, name: 'Pendule', castsPerTurn: 2 };
const COUP = { id: 7, name: 'Coup', castsPerTurn: 4, repeats: 3 };

test('la limite du jeu', async (t) => {
  await t.test('elle vient du sort', () => {
    assert.equal(limiteDe(PENDULE), 2);
  });

  await t.test('un sort sans limite lisible se lance une fois', () => {
    assert.equal(limiteDe({}), 1);
    assert.equal(limiteDe({ castsPerTurn: 0 }), 1);
    assert.equal(limiteDe(null), 1);
  });
});

test('les lancers comptes', async (t) => {
  await t.test('sans choix, un seul lancer compte', () => {
    assert.equal(lancersDe(PENDULE), 1);
  });

  await t.test('le choix du joueur fait foi', () => {
    assert.equal(lancersDe(COUP), 3);
  });

  await t.test('il ne depasse jamais la limite du jeu', () => {
    assert.equal(lancersDe({ castsPerTurn: 2, repeats: 5 }), 2);
  });

  await t.test('il ne descend jamais sous un lancer', () => {
    for (const repeats of [0, -3, Number.NaN, null, 'deux']) {
      assert.equal(lancersDe({ castsPerTurn: 3, repeats }), 1);
    }
  });
});

test('poser un nombre de lancers', async (t) => {
  const sorts = [PENDULE, COUP];

  await t.test('il ne touche que le sort vise', () => {
    const apres = avecLancers(sorts, 13294, 2);
    assert.equal(apres[0].repeats, 2);
    assert.equal(apres[1].repeats, 3);
  });

  await t.test('la liste d origine ne bouge pas', () => {
    avecLancers(sorts, 13294, 2);
    assert.equal(PENDULE.repeats, undefined);
  });

  await t.test('une valeur hors bornes se ramene dans les bornes', () => {
    assert.equal(avecLancers(sorts, 13294, 9)[0].repeats, 2);
    assert.equal(avecLancers(sorts, 13294, 0)[0].repeats, 1);
  });

  await t.test('un sort absent laisse la liste telle quelle', () => {
    assert.deepEqual(avecLancers(sorts, 999, 2), sorts);
  });
});
