/**
 * Les coches de la comparaison survivent au redessin des listes.
 *
 * Les candidats se recreent a chaque vague, les essais se relisent du
 * rangement : l'objet change, le stuff non. La cle porte donc sur le stuff.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { basculerChoix, cleDeChoix, rafraichirChoix } from '../web/v2/choix-comparaison.mjs';

test('cle de choix', async (t) => {
  await t.test('un candidat se reconnait a ses pieces, quel que soit l\'ordre', () => {
    assert.equal(cleDeChoix({ itemIds: [3, 1, 2] }, 'trouve'), cleDeChoix({ itemIds: [1, 2, 3] }, 'trouve'));
  });

  await t.test('le meme stuff dans deux listes fait deux choix', () => {
    assert.notEqual(cleDeChoix({ itemIds: [1] }, 'trouve'), cleDeChoix({ itemIds: [1] }, 'palier'));
  });

  await t.test('un essai se reconnait a son identifiant', () => {
    assert.equal(cleDeChoix({ id: 'abc', pieces: [{ id: 1 }] }, 'essai'), 'essai:abc');
  });

  await t.test('un essai sans identifiant retombe sur ses pieces', () => {
    assert.equal(cleDeChoix({ pieces: [{ id: 2 }, { id: 1 }] }, 'essai'), 'essai:1,2');
  });
});

test('basculer', async (t) => {
  const a = { itemIds: [1, 2] };

  await t.test('coche puis decoche, sans toucher la table de depart', () => {
    const vide = new Map();
    const coche = basculerChoix(vide, a, 'trouve', 'Trouvé 1');
    assert.equal(vide.size, 0);
    assert.equal(coche.size, 1);
    assert.deepEqual([...coche.values()][0], { objet: a, nom: 'Trouvé 1', famille: 'trouve' });

    const decoche = basculerChoix(coche, { itemIds: [2, 1] }, 'trouve', 'Trouvé 4');
    assert.equal(decoche.size, 0, 'le meme stuff, recree, decoche la coche');
  });
});

test('rafraichir', async (t) => {
  await t.test('garde les coches encore a l\'ecran, avec leur objet du jour', () => {
    const ancien = { itemIds: [1, 2], damage: 10 };
    const nouveau = { itemIds: [2, 1], damage: 12 };
    const perdu = { itemIds: [9] };
    const choisis = basculerChoix(basculerChoix(new Map(), ancien, 'trouve', 'Trouvé 1'),
      perdu, 'trouve', 'Trouvé 2');

    const propres = rafraichirChoix(choisis, [{ objet: nouveau, famille: 'trouve' }]);
    assert.equal(propres.size, 1);
    assert.equal([...propres.values()][0].objet, nouveau);
  });

  await t.test('rend la meme table quand rien ne change', () => {
    const a = { itemIds: [1] };
    const choisis = basculerChoix(new Map(), a, 'trouve', 'Trouvé 1');
    assert.equal(rafraichirChoix(choisis, [{ objet: a, famille: 'trouve' }]), choisis);
  });
});
