/**
 * Sorts enregistres par une version passee.
 *
 * Un sort deja au format courant ne bouge pas : les modifications du joueur
 * restent. Un sort ancien se reconstruit depuis le catalogue, et un sort que
 * le catalogue ne connait plus recoit au moins les champs manquants.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { enrichirSorts } from '../web/sorts-migration.mjs';

const CATALOGUE = [{
  id: 1, spells: [{
    id: 100, fr: 'Flamme', icon: null, apCost: 3, maxCast: 2, exclusiveGroup: 'g1',
    variants: [
      { level: 1, critRate: 5, element: 'feu', min: 10, max: 12, critMin: 12, critMax: 14, telefragCible: null },
      { level: 150, critRate: 10, element: 'feu', min: 30, max: 34, critMin: 36, critMax: 40,
        telefragCible: { bonusImmediat: 4 } },
    ],
  }],
}];

/** Les lignes que le catalogue donne au niveau 200 : un sort a jour les porte. */
const LIGNES_A_JOUR = [{
  element: 'feu', min: 30, max: 34, critMin: 36, critMax: 40, source: 'sort', range: null,
}];

const A_JOUR = {
  id: 100, name: 'Flamme modifiee', exclusiveGroup: 'g1', telefragCible: null,
  lines: LIGNES_A_JOUR,
};

test('des sorts a jour restent la meme liste', () => {
  const sorts = [A_JOUR];
  const { sorts: rendus, changes } = enrichirSorts(sorts, CATALOGUE, 200);
  assert.equal(changes, false);
  assert.equal(rendus, sorts);
});

test('un sort ancien se reconstruit a la variante de son niveau', () => {
  const ancien = { id: 100, name: 'Flamme', lines: [{ element: 'feu', min: 1, max: 2 }] };
  const { sorts, changes } = enrichirSorts([ancien], CATALOGUE, 200);
  assert.equal(changes, true);
  assert.equal(sorts[0].lines[0].min, 30, 'la variante 150 vaut au niveau 200');
  assert.equal(sorts[0].baseCrit, 10);
  assert.equal(sorts[0].exclusiveGroup, 'g1');
  assert.deepEqual(sorts[0].telefragCible, { bonusImmediat: 4 });

  const bas = enrichirSorts([ancien], CATALOGUE, 50).sorts[0];
  assert.equal(bas.lines[0].min, 10, 'au niveau 50, la premiere variante');
});

test('un sort inconnu du catalogue recoit les champs manquants sans perdre le reste', () => {
  const inconnu = { id: 999, name: 'Perdu', lines: [{ element: 'eau', min: 5, max: 6 }] };
  const { sorts } = enrichirSorts([inconnu], CATALOGUE, 200);
  assert.equal(sorts[0].exclusiveGroup, null);
  assert.equal(sorts[0].telefragCible, null);
  assert.equal(sorts[0].lines[0].min, 5);
});

test('seul le bonus telefrag se complete quand il manque a un sort recent', () => {
  const sansTelefrag = { id: 100, name: 'Flamme retouchee', exclusiveGroup: 'g1', lines: [{ min: 1 }] };
  const { sorts } = enrichirSorts([sansTelefrag], CATALOGUE, 200);
  assert.equal(sorts[0].name, 'Flamme retouchee', 'la retouche du joueur reste');
  assert.deepEqual(sorts[0].telefragCible, { bonusImmediat: 4 });
});

test('les sorts d\'entree ne bougent pas', () => {
  const ancien = { id: 100, name: 'Flamme' };
  enrichirSorts([ancien], CATALOGUE, 200);
  assert.deepEqual(ancien, { id: 100, name: 'Flamme' });
});

test('les lignes de degats suivent le catalogue', async (t) => {
  await t.test('un sort qui porte de vieilles lignes les reprend', () => {
    // C'est le cas de Pendule : le catalogue ne compte plus son coup deux
    // fois, mais le sort garde dans l'etat du joueur le comptait encore.
    const double = {
      ...A_JOUR,
      lines: [...LIGNES_A_JOUR, ...LIGNES_A_JOUR],
    };
    const { sorts, changes } = enrichirSorts([double], CATALOGUE, 200);
    assert.equal(changes, true);
    assert.equal(sorts[0].lines.length, 1);
  });

  await t.test('ce que le joueur a regle ne bouge pas', () => {
    const regle = { ...A_JOUR, lines: [], repeats: 2, unParTour: true };
    const [sort] = enrichirSorts([regle], CATALOGUE, 200).sorts;
    assert.equal(sort.repeats, 2, 'le nombre de lancers reste');
    assert.equal(sort.unParTour, true);
    assert.equal(sort.name, 'Flamme modifiee', 'le nom reste');
    assert.equal(sort.lines.length, 1, 'les lignes, elles, suivent le jeu');
  });

  await t.test('un sort que le catalogue ignore garde ses lignes', () => {
    const inconnu = { id: 999, exclusiveGroup: null, telefragCible: null, lines: LIGNES_A_JOUR };
    const [sort] = enrichirSorts([inconnu], CATALOGUE, 200).sorts;
    assert.deepEqual(sort.lines, LIGNES_A_JOUR);
  });

  await t.test('sans catalogue charge, rien ne bouge', () => {
    const sorts = [A_JOUR];
    assert.equal(enrichirSorts(sorts, [], 200).sorts, sorts);
  });
});
