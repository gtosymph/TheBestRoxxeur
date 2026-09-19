import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CIBLE_VIDE, estVide, normaliserCible, resistancesCible, SANS_RESISTANCE,
} from '../src/engine/cible.mjs';
import { computeHit, computeSpell } from '../src/engine/damage.mjs';
import { damageValue, scoreBuild } from '../src/solver/score.mjs';
import { emptyStats } from '../src/data/stats.mjs';

const stats = () => ({ ...emptyStats(), force: 100, puissance: 0 });

test('resistances de la cible', async (t) => {
  await t.test('sans monstre, les resistances posees a la main comptent', () => {
    const cible = normaliserCible({ manuel: { feu: 25, terre: -10 }, monstres: [] });
    assert.deepEqual(resistancesCible(cible), { neutre: 0, terre: -10, feu: 25, eau: 0, air: 0 });
  });

  await t.test('avec des monstres, la moyenne par element remplace la main', () => {
    const cible = normaliserCible({
      manuel: { feu: 99 },
      monstres: [
        { id: 1, nom: 'A', grade: 1, niveau: 10, res: { neutre: 10, terre: 20, feu: 30, eau: 40, air: 50 } },
        { id: 2, nom: 'B', grade: 5, niveau: 20, res: { neutre: 20, terre: 20, feu: 0, eau: 0, air: -50 } },
      ],
    });
    assert.deepEqual(resistancesCible(cible), { neutre: 15, terre: 20, feu: 15, eau: 20, air: 0 });
  });

  await t.test('une cible malformee retombe sur la cible vide', () => {
    assert.deepEqual(normaliserCible(null), CIBLE_VIDE);
    assert.deepEqual(normaliserCible({ manuel: { feu: 'abc' }, monstres: 'x' }), CIBLE_VIDE);
    assert.equal(estVide(CIBLE_VIDE), true);
    assert.equal(estVide(normaliserCible({ manuel: { feu: 1 } })), false);
  });

  await t.test('un monstre sans resistance lisible est ignore', () => {
    const cible = normaliserCible({ monstres: [{ id: 3 }, 'rien', null] });
    assert.deepEqual(cible.monstres, []);
  });
});

test('la resistance de la cible reduit chaque coup', async (t) => {
  const s = stats();
  const coup = { element: 'terre', base: 100 };

  await t.test('zero pour cent ne change rien', () => {
    assert.equal(computeHit(coup, s, SANS_RESISTANCE), computeHit(coup, s));
  });

  await t.test('la reduction s\'applique en dernier, arrondie vers le bas', () => {
    // 100 * (100 + 100) / 100 = 200 ; 200 * 0.67 = 134.
    assert.equal(computeHit(coup, s, { terre: 33 }), 134);
    // 201 * 0.67 = 134.67 -> 134
    assert.equal(computeHit({ element: 'terre', base: 100.5 }, s, { terre: 33 }), 134);
  });

  await t.test('une resistance negative augmente le coup', () => {
    assert.equal(computeHit(coup, s, { terre: -50 }), 300);
  });

  await t.test('cent pour cent ou plus annule le coup', () => {
    assert.equal(computeHit(coup, s, { terre: 100 }), 0);
    assert.equal(computeHit(coup, s, { terre: 140 }), 0);
  });

  await t.test('seul l\'element du coup compte', () => {
    assert.equal(computeHit(coup, s, { feu: 50 }), 200);
  });

  await t.test('la poussee ne subit pas les resistances elementaires', () => {
    assert.equal(computeHit({ element: 'poussee', base: 50 }, s, { neutre: 50 }), 50);
  });

  await t.test('le sort et le score la suivent', () => {
    const sort = { lines: [{ element: 'terre', min: 100, max: 100 }] };
    assert.equal(computeSpell(sort, s).average, 200);
    assert.equal(computeSpell(sort, s, { terre: 50 }).average, 100);
    assert.equal(damageValue([sort], s, { terre: 50 }).total, 100);
    assert.equal(scoreBuild(s, { conditions: [], spells: [sort], cible: { terre: 50 } }).damage, 100);
    assert.equal(scoreBuild(s, { conditions: [], spells: [sort] }).damage, 200);
  });
});
