/**
 * Le mode « Monter » : chercher le stuff qui fait monter le plus vite.
 *
 * L'XP d'un combat se multiplie par 1 + sagesse / 100. Le nombre de combats
 * par heure, lui, depend de la vitesse a tuer, donc des degats. L'XP gagnee
 * dans une heure vaut donc le produit des deux, et non leur somme ponderee :
 * tuer deux fois plus vite vaut exactement autant que doubler le
 * multiplicateur. C'est pour cela que ce mode n'a aucun curseur.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { SEARCH_MODES, scoreBuild, vitesseXp } from '../src/solver/score.mjs';

const SORT = {
  name: 'Sort', apCost: 3, castsPerTurn: 1, baseCrit: 0,
  lines: [{ element: 'feu', min: 100, max: 100, critMin: 100, critMax: 100, source: 'sort', range: 'melee' }],
};

const objectifXp = (conditions = []) => ({
  conditions, spells: [SORT], mode: SEARCH_MODES.XP, cible: null,
});

test('la vitesse d XP', async (t) => {
  await t.test('sans sagesse, elle vaut les degats', () => {
    assert.equal(vitesseXp(1000, 0), 1000);
  });

  await t.test('cent de sagesse double la vitesse', () => {
    assert.equal(vitesseXp(1000, 100), 2000);
  });

  await t.test('elle est bien un produit, pas une somme', () => {
    // Deux fois moins de degats et deux fois plus de multiplicateur : egalite.
    assert.equal(vitesseXp(1000, 100), vitesseXp(500, 300));
  });

  await t.test('une sagesse absente ou negative ne retranche rien', () => {
    assert.equal(vitesseXp(800, undefined), 800);
    assert.equal(vitesseXp(800, -50), 800);
  });

  await t.test('sans degats, aucune sagesse ne fait monter', () => {
    assert.equal(vitesseXp(0, 500), 0);
  });
});

test('le score du mode Monter', async (t) => {
  await t.test('il rend la vitesse d XP, et la dit', () => {
    const stats = { intelligence: 0, sagesse: 200 };
    const detail = scoreBuild(stats, objectifXp());

    assert.equal(detail.sagesse, 200);
    assert.equal(detail.xp, detail.damage * 3);
    assert.equal(detail.score, detail.xp);
  });

  await t.test('un stuff qui manque une condition passe sous tous les autres', () => {
    const manque = scoreBuild({ sagesse: 400, pa: 6 }, objectifXp([{ stat: 'pa', target: 12, weight: 500 }]));
    const tient = scoreBuild({ sagesse: 10, pa: 12 }, objectifXp([{ stat: 'pa', target: 12, weight: 500 }]));

    assert.equal(manque.satisfied, false);
    assert.ok(manque.score < 0, 'un defaut de condition se paie');
    assert.ok(tient.score > manque.score, 'tenir ses conditions passe avant la sagesse');
  });

  await t.test('a degats egaux, la sagesse departage', () => {
    const peu = scoreBuild({ sagesse: 100 }, objectifXp());
    const beaucoup = scoreBuild({ sagesse: 300 }, objectifXp());
    assert.ok(beaucoup.score > peu.score);
    assert.equal(beaucoup.damage, peu.damage, 'les degats ne bougent pas');
  });

  await t.test('a sagesse egale, les degats departagent', () => {
    const faible = scoreBuild({ sagesse: 100, intelligence: 0 }, objectifXp());
    const fort = scoreBuild({ sagesse: 100, intelligence: 500 }, objectifXp());
    assert.ok(fort.score > faible.score);
  });
});
