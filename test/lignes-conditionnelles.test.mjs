/**
 * Lignes de degats sous condition.
 *
 * Certains coups ne tombent que si le combat s'y prete : Aiguille frappe une
 * seconde fois quand la cible perd le Telefrag. Compter ce coup d'office
 * promettrait des degats que le joueur n'obtient pas toujours ; l'oublier
 * cache ce que le sort vaut dans le bon enchainement. La ligne porte donc sa
 * condition, et le sort porte le choix du joueur, comme pour le differe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSpell, computeSpellDetail } from '../src/engine/damage.mjs';
import { damageValue } from '../src/solver/score.mjs';
import { emptyStats } from '../src/data/stats.mjs';

const NUES = Object.freeze({ ...emptyStats() });

/** Un coup du tour, et un coup si la cible perd le Telefrag. */
const SORT = Object.freeze({
  id: 13244, name: 'Aiguille', apCost: 2, castsPerTurn: 1, baseCrit: 0,
  lines: [
    { element: 'terre', min: 9, max: 12, critMin: 13, critMax: 16, source: 'sort' },
    {
      element: 'terre', min: 9, max: 12, critMin: 13, critMax: 16, source: 'sort',
      condition: 'Si la cible perd le Téléfrag',
    },
  ],
});

test('une ligne sous condition ne compte pas par defaut', async (t) => {
  await t.test('la moyenne ne garde que le coup sur', () => {
    const seul = computeSpell({ ...SORT, lines: [SORT.lines[0]] }, NUES);
    assert.equal(computeSpell(SORT, NUES).average, seul.average);
  });

  await t.test('la ligne se lit a part, dans « conditionnel »', () => {
    const detail = computeSpell(SORT, NUES);
    assert.ok(detail.conditionnel > 0);
    assert.equal(detail.differe, 0);
  });

  await t.test('les bornes montrees ne la comptent pas', () => {
    assert.equal(computeSpellDetail(SORT, NUES).normalMax, 12);
  });
});

test('compterCondition fait entrer la ligne dans le total', async (t) => {
  const compte = { ...SORT, compterCondition: true };

  await t.test('la moyenne cumule les deux coups', () => {
    const sans = computeSpell(SORT, NUES);
    assert.equal(computeSpell(compte, NUES).average, sans.average + sans.conditionnel);
  });

  await t.test('le score du solveur suit le choix', () => {
    assert.ok(damageValue([compte], NUES).total > damageValue([SORT], NUES).total);
  });

  await t.test('les bornes montrees la comptent', () => {
    assert.equal(computeSpellDetail(compte, NUES).normalMax, 24);
  });

  await t.test('le detail par ligne garde la condition', () => {
    const [, seconde] = computeSpellDetail(compte, NUES).parLigne;
    assert.equal(seconde.condition, 'Si la cible perd le Téléfrag');
  });
});

test('une ligne a la fois differee et sous condition exige les deux choix', () => {
  const double = {
    ...SORT,
    lines: [SORT.lines[0], { ...SORT.lines[1], differe: 1 }],
  };
  const base = computeSpell(double, NUES).average;

  assert.equal(computeSpell({ ...double, compterDiffere: true }, NUES).average, base);
  assert.equal(computeSpell({ ...double, compterCondition: true }, NUES).average, base);
  assert.ok(computeSpell({ ...double, compterDiffere: true, compterCondition: true }, NUES).average > base);
});
