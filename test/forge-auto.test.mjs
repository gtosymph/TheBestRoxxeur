/**
 * La forgemagie decidee par le moteur.
 *
 * Deux pieges. Le premier : oublier ce que le joueur a deja pose. Une piece
 * qui porte un exo PA n'a plus qu'un poids de libre, et lui ajouter cent un
 * points de force annoncerait un stuff que personne ne peut forger. Le
 * second : pousser une ligne que la piece ne porte pas, ce qui n'est pas un
 * over mais un exotique, et ne se forge pas comme ca.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { BUDGET_POIDS } from '../src/engine/runes.mjs';
import { forgerAuto, fusionnerExos, poidsPorte } from '../src/engine/forge-auto.mjs';

const AMULETTE = { id: 1, stats: { force: 40, vitalite: 200 } };
const CAPE = { id: 2, stats: { intelligence: 50 } };
const CEINTURE = { id: 3, stats: { sagesse: 30 } };

test('le poids deja porte par une piece', async (t) => {
  await t.test('un exo PA pese cent', () => {
    assert.equal(poidsPorte({ pa: 1 }), 100);
  });

  await t.test('un over de vitalite pese un cinquieme par point', () => {
    assert.equal(poidsPorte({ vitalite: 50 }), 10);
  });

  await t.test('une ligne qui ne se forge pas ne pese rien', () => {
    assert.equal(poidsPorte({ pdvEffectifs: 500 }), 0);
  });

  await t.test('une piece sans rien ne pese rien', () => {
    assert.equal(poidsPorte(null), 0);
    assert.equal(poidsPorte({}), 0);
  });
});

test('la forgemagie automatique', async (t) => {
  await t.test('elle pousse la meilleure ligne de chaque piece', () => {
    const { table, overs } = forgerAuto({
      items: [AMULETTE, CAPE],
      valeurs: { force: 3, intelligence: 3, vitalite: 0.1 },
      budget: BUDGET_POIDS,
    });

    assert.deepEqual(table.get(1), { force: 101 });
    assert.deepEqual(table.get(2), { intelligence: 101 });
    assert.deepEqual(overs, [
      { id: 1, stat: 'force', valeur: 101 },
      { id: 2, stat: 'intelligence', valeur: 101 },
    ]);
  });

  await t.test('elle laisse la piece que l objectif ne valorise pas', () => {
    const { table } = forgerAuto({
      items: [AMULETTE, CEINTURE],
      valeurs: { force: 3 },
      budget: BUDGET_POIDS,
    });
    assert.deepEqual(table.get(1), { force: 101 });
    assert.equal(table.has(3), false);
  });

  await t.test('un exo pose par le joueur mange le budget de sa piece', () => {
    // L'exo PA pese cent : il ne reste qu'un poids, soit un point de force.
    const exos = new Map([[1, { pa: 1 }]]);
    const { table } = forgerAuto({
      items: [AMULETTE],
      valeurs: { force: 3, vitalite: 0.1 },
      budget: BUDGET_POIDS,
      exos,
    });
    assert.deepEqual(table.get(1), { force: 1 });
  });

  await t.test('un over deja pose par le joueur compte dans le budget', () => {
    const exos = new Map([[1, { force: 50 }]]);
    const { table } = forgerAuto({
      items: [AMULETTE], valeurs: { force: 3 }, budget: BUDGET_POIDS, exos,
    });
    assert.deepEqual(table.get(1), { force: 51 });
  });

  await t.test('une piece pleine ne recoit plus rien', () => {
    const exos = new Map([[1, { force: 101 }]]);
    const { table, overs } = forgerAuto({
      items: [AMULETTE], valeurs: { force: 3 }, budget: BUDGET_POIDS, exos,
    });
    assert.equal(table.has(1), false);
    assert.deepEqual(overs, []);
  });

  await t.test('un budget nul ne forge rien', () => {
    const { table, overs } = forgerAuto({ items: [AMULETTE], valeurs: { force: 3 }, budget: 0 });
    assert.equal(table.size, 0);
    assert.deepEqual(overs, []);
  });

  await t.test('sans valeur, rien ne se forge', () => {
    const { table } = forgerAuto({ items: [AMULETTE], valeurs: {}, budget: BUDGET_POIDS });
    assert.equal(table.size, 0);
  });

  await t.test('la meme piece deux fois ne se forge qu une fois', () => {
    const { overs } = forgerAuto({
      items: [AMULETTE, AMULETTE], valeurs: { force: 3 }, budget: BUDGET_POIDS,
    });
    assert.equal(overs.length, 1);
  });
});

test('la fusion des exos', async (t) => {
  await t.test('elle additionne les lignes des deux tables', () => {
    const joueur = new Map([[1, { pa: 1, force: 20 }]]);
    const auto = new Map([[1, { force: 30 }], [2, { chance: 50 }]]);
    const fusion = fusionnerExos(joueur, auto);

    assert.deepEqual(fusion.get(1), { pa: 1, force: 50 });
    assert.deepEqual(fusion.get(2), { chance: 50 });
  });

  await t.test('elle ne touche pas aux tables d origine', () => {
    const joueur = new Map([[1, { force: 20 }]]);
    const auto = new Map([[1, { force: 30 }]]);
    fusionnerExos(joueur, auto);

    assert.deepEqual(joueur.get(1), { force: 20 });
    assert.deepEqual(auto.get(1), { force: 30 });
  });

  await t.test('une table vide rend l autre', () => {
    const joueur = new Map([[1, { force: 20 }]]);
    assert.deepEqual(fusionnerExos(joueur, new Map()).get(1), { force: 20 });
    assert.deepEqual(fusionnerExos(null, joueur).get(1), { force: 20 });
  });
});
