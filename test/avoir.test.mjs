/**
 * Les trois listes que le joueur tient.
 *
 * Le volet gauche en donnait le compte sans jamais dire LESQUELLES. Ce module
 * decrit les trois bascules qui ouvrent chacune sa liste dans la palette.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { aideAvoir, basculesAvoir, LISTES_AVOIR, suivanteAvoir } from '../web/v2/avoir.mjs';

const ETAT = {
  possedees: new Set([1, 2]),
  bannis: new Set([3]),
  reference: { itemIds: [4, 5, 6] },
  filtreAvoir: null,
};

test('les bascules des trois listes', async (t) => {
  await t.test('chacune porte son compte', () => {
    const vues = basculesAvoir(ETAT);
    assert.deepEqual(vues.map((v) => v.cle), [...LISTES_AVOIR]);
    assert.deepEqual(vues.map((v) => v.compte), [2, 1, 3]);
  });

  await t.test('celle qui est posee se sait active', () => {
    const vues = basculesAvoir({ ...ETAT, filtreAvoir: 'interdits' });
    assert.deepEqual(vues.map((v) => v.actif), [false, true, false]);
  });

  await t.test('sans stuff fige, la troisieme ne se clique pas', () => {
    const vues = basculesAvoir({ ...ETAT, reference: null });
    const stuff = vues.find((v) => v.cle === 'stuff');
    assert.equal(stuff.compte, 0);
    assert.equal(stuff.possible, false);
    assert.ok(stuff.titre.length > 0, 'elle dit pourquoi elle est fermee');
  });

  await t.test('une liste vide reste cliquable : elle montre son vide', () => {
    const vues = basculesAvoir({ ...ETAT, bannis: new Set() });
    assert.equal(vues.find((v) => v.cle === 'interdits').possible, true);
  });

  await t.test('un etat nu ne casse rien', () => {
    assert.deepEqual(basculesAvoir({}).map((v) => v.compte), [0, 0, 0]);
    assert.deepEqual(basculesAvoir(null).map((v) => v.actif), [false, false, false]);
  });
});

test('la bascule rend le filtre suivant', async (t) => {
  await t.test('poser une liste quand aucune n est posee', () => {
    assert.equal(suivanteAvoir(null, 'banque'), 'banque');
  });

  await t.test('recliquer la meme liste la releve', () => {
    assert.equal(suivanteAvoir('banque', 'banque'), null);
  });

  await t.test('cliquer une autre liste remplace, elle ne cumule pas', () => {
    assert.equal(suivanteAvoir('banque', 'stuff'), 'stuff');
  });
});

test('ce que le pied de la palette dit', async (t) => {
  await t.test('hors liste, il dit que le clic pose la piece', () => {
    assert.match(aideAvoir(null, 40), /poser/);
  });

  await t.test('dans une liste pleine, il dit que le clic ouvre', () => {
    assert.match(aideAvoir('banque', 12), /ouvrir/);
  });

  await t.test('une liste vide dit comment la remplir', () => {
    assert.match(aideAvoir('banque', 0), /Je l'ai déjà/);
    assert.match(aideAvoir('interdits', 0), /Interdire/);
    assert.match(aideAvoir('stuff', 0), /Aucune pièce/);
  });
});
