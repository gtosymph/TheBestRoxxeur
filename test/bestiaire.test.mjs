import test from 'node:test';
import assert from 'node:assert/strict';

import { chercherMonstres, gradesDe, versCible } from '../src/data/bestiaire.mjs';
import { normaliserCible, resistancesCible } from '../src/engine/cible.mjs';

const LARVE = {
  id: 31, nom: 'Larve Bleue', race: 'Larves', boss: 0,
  grades: [[1, 16, 90, 1, 6, 6, -9, -9], [5, 20, 130, 5, 10, 10, -5, -5]],
};
const COMTE = {
  id: 3416, nom: 'Comte Harebourg', race: 'Sinistros', boss: 2,
  grades: [[1, 220, 13000, 14, 17, 16, 29, 25], [5, 220, 20000, 14, 17, 16, 29, 25]],
};
const MINI = { id: 9, nom: 'Bworkette', race: 'Bworks', boss: 1, grades: [[1, 40, 500, 0, 0, 0, 0, 0]] };

test('les grades se relisent depuis le tableau plat', () => {
  assert.deepEqual(gradesDe(LARVE)[0], {
    grade: 1, niveau: 16, pdv: 90, res: { neutre: 1, terre: 6, feu: 6, eau: -9, air: -9 },
  });
  assert.deepEqual(gradesDe({ grades: 'rien' }), []);
});

test('un monstre a un grade devient une entree de cible', () => {
  const entree = versCible(COMTE, 5);
  assert.deepEqual(entree, {
    id: 3416, nom: 'Comte Harebourg', grade: 5, niveau: 220,
    res: { neutre: 14, terre: 17, feu: 16, eau: 29, air: 25 },
  });
  // Elle passe la normalisation de la cible telle quelle.
  const cible = normaliserCible({ monstres: [entree] });
  assert.equal(resistancesCible(cible).eau, 29);
});

test('un grade inconnu retombe sur le dernier grade', () => {
  assert.equal(versCible(COMTE, 9).grade, 5);
  assert.equal(versCible(COMTE, 0).grade, 5);
});

test('la recherche filtre par nom, sans accents ni casse, et trie les boss en tete', () => {
  const liste = [LARVE, COMTE, MINI];
  assert.deepEqual(chercherMonstres(liste, { terme: 'harebourg' }).map((m) => m.id), [3416]);
  assert.deepEqual(chercherMonstres(liste, { terme: 'LARVE' }).map((m) => m.id), [31]);
  assert.deepEqual(chercherMonstres(liste, { terme: '' }).map((m) => m.id), [3416, 9, 31]);
});

test('la recherche filtre par niveau et par type', () => {
  const liste = [LARVE, COMTE, MINI];
  assert.deepEqual(chercherMonstres(liste, { niveauMin: 30, niveauMax: 100 }).map((m) => m.id), [9]);
  assert.deepEqual(chercherMonstres(liste, { boss: true }).map((m) => m.id), [3416, 9]);
  assert.equal(chercherMonstres(liste, {}, 2).length, 2);
});
