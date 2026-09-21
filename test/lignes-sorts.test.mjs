/**
 * Les lignes de degats d'un sort.
 *
 * Une regle fausse ici ne leve aucune erreur : elle se contente de mentir sur
 * tous les ecrans a la fois. Pendule annoncait deux fois ses degats parce que
 * le jeu ecrit son coup deux fois — une fois pour la cible, une fois pour la
 * zone autour du lanceur.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { lignesDuPalier, lireMasque } from '../src/data/lignes-sorts.mjs';

/** Un effet de degats, avec sa zone. */
const degats = (effectId, min, max, masque, zone = { shape: 80, param1: 1, param2: 0 }, reste = {}) => ({
  effectId, diceNum: min, diceSide: max, targetMask: masque, zoneDescr: zone, ...reste,
});

const CELLULE = { shape: 80, param1: 1, param2: 0 };
const CERCLE_2 = { shape: 67, param1: 2, param2: 1 };

test('lireMasque', async (t) => {
  await t.test('separe les groupes des etats exiges', () => {
    assert.deepEqual(lireMasque('a,A,E42'), { groupes: ['a', 'A'], exigeEtat: true, etats: ['E42'] });
    assert.deepEqual(lireMasque('A'), { groupes: ['A'], exigeEtat: false, etats: [] });
    assert.deepEqual(lireMasque(''), { groupes: [], exigeEtat: false, etats: [] });
  });
});

test('les lignes d un palier', async (t) => {
  await t.test('un sort a une ligne rend une ligne', () => {
    const palier = { effects: [degats(98, 20, 25, 'A')], criticalEffect: [degats(98, 24, 30, 'A')] };
    assert.deepEqual(lignesDuPalier(palier), [
      { element: 'air', min: 20, max: 25, critMin: 24, critMax: 30 },
    ]);
  });

  await t.test('deux coups identiques sur la MEME zone restent deux coups', () => {
    const palier = {
      effects: [degats(97, 15, 18, 'A', CELLULE), degats(97, 15, 18, 'A', CELLULE)],
      criticalEffect: [degats(97, 18, 21, 'A', CELLULE), degats(97, 18, 21, 'A', CELLULE)],
    };
    assert.equal(lignesDuPalier(palier).length, 2, 'un sort qui frappe deux fois la meme case');
  });

  await t.test('le meme coup sous deux ZONES ne compte qu une fois', () => {
    // C'est Pendule : « 33 a 36 Air » sur la cible, et « 33 a 36 Air » sur le
    // cercle autour du lanceur. Un ennemi n'en prend qu'un.
    const palier = {
      effects: [degats(98, 33, 36, 'A', CELLULE), degats(98, 33, 36, 'A', CERCLE_2)],
      criticalEffect: [degats(98, 40, 43, 'A', CELLULE), degats(98, 40, 43, 'A', CERCLE_2)],
    };
    assert.deepEqual(lignesDuPalier(palier), [
      { element: 'air', min: 33, max: 36, critMin: 40, critMax: 43 },
    ]);
  });

  await t.test('le meme coup sous deux masques ne compte qu une fois', () => {
    const palier = {
      effects: [degats(99, 10, 12, 'A', CELLULE), degats(99, 10, 12, 'a', CELLULE)],
      criticalEffect: [degats(99, 12, 14, 'A', CELLULE), degats(99, 12, 14, 'a', CELLULE)],
    };
    assert.equal(lignesDuPalier(palier).length, 1);
  });

  await t.test('les lignes qui ne visent pas l ennemi sortent', () => {
    const palier = {
      effects: [degats(96, 30, 35, 'A', CELLULE), degats(96, 50, 60, 'c', CELLULE)],
      criticalEffect: [],
    };
    const lignes = lignesDuPalier(palier);
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].min, 30);
  });

  await t.test('une ligne differee garde son delai', () => {
    const palier = {
      effects: [degats(100, 10, 14, 'A', CELLULE, { delay: 1 })],
      criticalEffect: [],
    };
    assert.equal(lignesDuPalier(palier)[0].differe, 1);
  });

  await t.test('des lignes toutes sous des etats distincts sont des alternatives', () => {
    const palier = {
      effects: [
        degats(97, 20, 24, 'A,E1', CELLULE),
        degats(99, 30, 34, 'A,E2', CELLULE),
        degats(96, 25, 28, 'A,E3', CELLULE),
      ],
      criticalEffect: [],
    };
    const lignes = lignesDuPalier(palier);
    assert.equal(lignes.length, 1, 'une seule des trois runes s applique');
    assert.equal(lignes[0].element, 'feu', 'la plus forte fait foi');
  });

  await t.test('la poussee reste une ligne de degats', () => {
    // Elle ne suit aucune caracteristique, mais elle frappe : soixante-trois
    // sorts la portent, et les perdre retirait leurs degats de poussee.
    const palier = {
      effects: [degats(98, 13, 15, 'A', CELLULE), degats(5, 1, 1, 'A', CELLULE)],
      criticalEffect: [],
    };
    const lignes = lignesDuPalier(palier);
    assert.equal(lignes.length, 2);
    assert.equal(lignes[1].element, 'poussee');
  });

  await t.test('un palier sans degats rend une liste vide', () => {
    assert.deepEqual(lignesDuPalier({ effects: [{ effectId: 950, value: 1 }] }), []);
    assert.deepEqual(lignesDuPalier({}), []);
    assert.deepEqual(lignesDuPalier(null), []);
  });
});
