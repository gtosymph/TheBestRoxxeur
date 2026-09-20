/**
 * Le poids des runes, et ce qu'une piece accepte.
 *
 * La forgemagie ne se decide pas ligne par ligne au hasard : chaque point de
 * caracteristique pese, et une piece n'accepte que cent un de poids d'over et
 * d'exo reunis. C'est cette regle qui rend un exo PA (poids cent) exclusif de
 * tout le reste, et qui borne l'over a cent un points de force.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUDGET_POIDS, POIDS_RUNE, choisirOver, poidsDe, pointsTenables,
} from '../src/engine/runes.mjs';

test('le poids des runes', async (t) => {
  await t.test('une caracteristique primaire pese un par point', () => {
    assert.equal(POIDS_RUNE.force, 1);
    assert.equal(poidsDe('force', 60), 60);
  });

  await t.test('la vitalite pese un cinquieme de point', () => {
    assert.equal(poidsDe('vitalite', 505), 101);
  });

  await t.test('les trois exos rares pesent ce que le jeu leur donne', () => {
    assert.equal(POIDS_RUNE.pa, 100);
    assert.equal(POIDS_RUNE.pm, 90);
    assert.equal(POIDS_RUNE.po, 51);
  });

  await t.test('une statistique inconnue ne se forge pas', () => {
    assert.equal(poidsDe('pdvEffectifs', 10), null);
  });
});

test('ce qu un budget de poids permet', async (t) => {
  await t.test('cent un de poids donnent cent un points de force', () => {
    assert.equal(pointsTenables('force', BUDGET_POIDS), 101);
  });

  await t.test('cent un de poids donnent cinq cent cinq de vitalite', () => {
    assert.equal(pointsTenables('vitalite', BUDGET_POIDS), 505);
  });

  await t.test('un budget trop court ne donne aucun point', () => {
    assert.equal(pointsTenables('dommages', 19), 0);
    assert.equal(pointsTenables('dommages', 20), 1);
  });

  await t.test('un budget nul ou negatif ne donne rien', () => {
    assert.equal(pointsTenables('force', 0), 0);
    assert.equal(pointsTenables('force', -5), 0);
  });
});

test('le choix de l over d une piece', async (t) => {
  const piece = { id: 1, stats: { force: 40, vitalite: 100, sagesse: 20 } };

  await t.test('la ligne retenue est celle qui rapporte le plus par poids', () => {
    // Un point de force vaut deux, un point de vitalite vaut un demi. La force
    // pese un, la vitalite un cinquieme : la vitalite rapporte 2,5 par poids,
    // la force 2. La vitalite gagne.
    assert.deepEqual(
      choisirOver(piece, { force: 2, vitalite: 0.5 }, BUDGET_POIDS),
      { stat: 'vitalite', valeur: 505, poids: 101 },
    );
  });

  await t.test('une ligne absente de la piece ne se pousse pas', () => {
    assert.equal(choisirOver(piece, { intelligence: 99 }, BUDGET_POIDS), null);
  });

  await t.test('une ligne sans valeur pour l objectif ne se pousse pas', () => {
    assert.equal(choisirOver(piece, { force: 0, vitalite: 0 }, BUDGET_POIDS), null);
  });

  await t.test('une valeur negative ne se pousse jamais', () => {
    assert.equal(choisirOver(piece, { force: -3 }, BUDGET_POIDS), null);
  });

  await t.test('un budget reduit rend moins de points', () => {
    assert.deepEqual(
      choisirOver(piece, { force: 5 }, 30),
      { stat: 'force', valeur: 30, poids: 30 },
    );
  });

  await t.test('un budget nul ne pose rien', () => {
    assert.equal(choisirOver(piece, { force: 5 }, 0), null);
  });

  await t.test('une piece sans ligne ne prend pas d over', () => {
    assert.equal(choisirOver({ id: 2, stats: {} }, { force: 5 }, BUDGET_POIDS), null);
    assert.equal(choisirOver({ id: 3 }, { force: 5 }, BUDGET_POIDS), null);
  });

  await t.test('une ligne negative de la piece ne se pousse pas', () => {
    const maudite = { id: 4, stats: { force: -20 } };
    assert.equal(choisirOver(maudite, { force: 5 }, BUDGET_POIDS), null);
  });
});
