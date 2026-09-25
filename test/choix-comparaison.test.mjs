/**
 * Les coches de la comparaison survivent au redessin des listes.
 *
 * Les candidats se recreent a chaque vague, les essais se relisent du
 * rangement : l'objet change, le stuff non. La cle porte donc sur le stuff.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  basculerChoix, cleDeChoix, colonnesAComparer, rafraichirChoix,
} from '../web/v2/choix-comparaison.mjs';

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

/**
 * Le stuff actuel, fige comme celui porte en jeu, entre dans la comparaison.
 *
 * C'est la question que le joueur pose le plus : « ce stuff trouve, face a
 * ce que j'ai vraiment ». La colonne se place juste apres le stuff porte, et
 * se tait quand elle ne montrerait que le stuff porte une deuxieme fois.
 */
test('les colonnes a comparer', async (t) => {
  const trouve = { itemIds: [7, 8] };
  const coches = basculerChoix(new Map(), trouve, 'trouve', 'Trouvé 1');

  await t.test('sans stuff actuel, le porte et les coches', () => {
    const colonnes = colonnesAComparer(coches, { reference: null, porteIds: [1, 2] });
    assert.deepEqual(colonnes.map((c) => c.nom), ['Porté', 'Trouvé 1']);
    assert.equal(colonnes[0].objet, null);
    assert.equal(colonnes[1].objet, trouve);
  });

  await t.test('le stuff actuel se place juste apres le porte', () => {
    const colonnes = colonnesAComparer(coches, {
      reference: { itemIds: [3, 4] }, porteIds: [1, 2],
    });
    assert.deepEqual(colonnes.map((c) => c.nom), ['Porté', 'Mon stuff actuel', 'Trouvé 1']);
    assert.deepEqual(colonnes[1].objet, { itemIds: [3, 4] });
  });

  await t.test('sans coche, le stuff actuel suffit a comparer', () => {
    const colonnes = colonnesAComparer(new Map(), {
      reference: { itemIds: [3, 4] }, porteIds: [1, 2],
    });
    assert.deepEqual(colonnes.map((c) => c.nom), ['Porté', 'Mon stuff actuel']);
  });

  await t.test('le stuff actuel se tait quand il est le stuff porte', () => {
    const colonnes = colonnesAComparer(coches, {
      reference: { itemIds: [2, 1] }, porteIds: [1, 2],
    });
    assert.deepEqual(colonnes.map((c) => c.nom), ['Porté', 'Trouvé 1']);
  });

  await t.test('une seule colonne ne se compare pas', () => {
    assert.deepEqual(colonnesAComparer(new Map(), { reference: null, porteIds: [1] })
      .map((c) => c.nom), ['Porté']);
  });
});
