import test from 'node:test';
import assert from 'node:assert/strict';

import { resumeCible, ETIQUETTES_ELEMENTS } from '../web/v2/cible.mjs';
import { CIBLE_VIDE, normaliserCible } from '../src/engine/cible.mjs';

const res = (neutre, terre, feu, eau, air) => ({ neutre, terre, feu, eau, air });

test('une cible vide se dit en une phrase', () => {
  assert.equal(resumeCible(CIBLE_VIDE), 'Dans le vide, sans résistance.');
});

test('des resistances posees a la main se lisent element par element', () => {
  const cible = normaliserCible({ manuel: res(0, 25, 0, 0, -10) });
  assert.equal(resumeCible(cible), 'Résistances posées à la main · 0/25/0/0/−10 %');
});

test('un monstre seul se nomme avec son grade', () => {
  const cible = normaliserCible({ monstres: [
    { id: 1, nom: 'Comte Harebourg', grade: 5, niveau: 200, res: res(14, 17, 16, 29, 25) },
  ] });
  assert.equal(resumeCible(cible), 'Comte Harebourg (grade 5) · 14/17/16/29/25 %');
});

test('plusieurs monstres donnent leur nombre et la moyenne', () => {
  const cible = normaliserCible({ monstres: [
    { id: 1, nom: 'A', grade: 1, niveau: 1, res: res(10, 10, 10, 10, 10) },
    { id: 2, nom: 'B', grade: 1, niveau: 1, res: res(20, 20, 20, 20, 20) },
    { id: 3, nom: 'C', grade: 1, niveau: 1, res: res(30, 30, 30, 30, 30) },
  ] });
  assert.equal(resumeCible(cible), '3 monstres, en moyenne · 20/20/20/20/20 %');
});

test('les elements portent une etiquette courte, dans l\'ordre du moteur', () => {
  assert.deepEqual(ETIQUETTES_ELEMENTS.map(([cle]) => cle), ['neutre', 'terre', 'feu', 'eau', 'air']);
});
