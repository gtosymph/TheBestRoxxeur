/**
 * Les effets que les donnees du jeu ne decrivent pas.
 *
 * Les donnees brutes d'Aiguille portent deux fois « 9 a 12 Terre », sans dire
 * quand chaque coup tombe. La fiche du jeu le dit : un poison au debut du tour
 * de la cible, puis un second coup si la cible perd le Telefrag. La table des
 * lignes speciales ecrit ces faits a la main, et ces tests les gardent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { LIGNES_SPECIALES, avecLignesSpeciales } from '../src/data/lignes-speciales.mjs';

const AIGUILLE = 13244;
const COUP = Object.freeze({ element: 'terre', min: 9, max: 12, critMin: 13, critMax: 16 });

test('Aiguille : un poison au tour suivant, et un coup sous condition', async (t) => {
  const lignes = avecLignesSpeciales(AIGUILLE, [COUP]);

  await t.test('le poison touche au tour suivant', () => {
    assert.deepEqual(lignes[0], { ...COUP, differe: 1 });
  });

  await t.test('le second coup attend la perte du Telefrag', () => {
    assert.equal(lignes.length, 2);
    assert.equal(lignes[1].differe, undefined);
    assert.match(lignes[1].condition, /Téléfrag/);
    assert.equal(lignes[1].min, 9);
    assert.equal(lignes[1].critMax, 16);
  });

  await t.test('les lignes recues ne changent pas', () => {
    assert.equal(COUP.differe, undefined);
  });
});

test('la table ne touche que ses sorts', () => {
  const lignes = [COUP];
  assert.equal(avecLignesSpeciales(1, lignes), lignes);
});

test('la table ne s\'applique pas deux fois', () => {
  // L'import peut repasser sur des lignes deja corrigees : le second coup ne
  // doit pas se dedoubler.
  const une = avecLignesSpeciales(AIGUILLE, [COUP]);
  assert.deepEqual(avecLignesSpeciales(AIGUILLE, une), une);
});

test('chaque entree de la table dit pourquoi elle existe', () => {
  for (const [id, entree] of Object.entries(LIGNES_SPECIALES)) {
    assert.ok(entree.nom, `sort ${id} sans nom`);
    assert.ok(entree.pourquoi?.length > 20, `sort ${id} sans raison`);
  }
});
