/**
 * Les sorts que le joueur ecrit lui-meme.
 *
 * Le catalogue ne couvre pas tout : un sort d'evenement, un effet d'allie, un
 * enchainement que le jeu ne decrit pas. Le joueur ecrit alors son sort, avec
 * autant de lignes de degats qu'il veut. Ce que l'outil garantit : un sort
 * ecrit se calcule toujours, et une saisie absurde se refuse avec un message
 * qui dit quoi corriger.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_LIGNES, avecSortPerso, compacterSortPerso, decompacterSortPerso, estSortPerso,
  nouveauSortPerso, verifierSortPerso,
} from '../src/data/sort-perso.mjs';
import { computeSpell } from '../src/engine/damage.mjs';
import { emptyStats } from '../src/data/stats.mjs';

const LIGNE = { element: 'feu', min: 10, max: 12, critMin: 13, critMax: 15 };

/** Un sort ecrit par le joueur, avant verification. */
function brouillon(champs = {}) {
  return {
    ...nouveauSortPerso([]),
    name: 'Mon combo', apCost: 3, castsPerTurn: 2, baseCrit: 10,
    lines: [LIGNE, { ...LIGNE, element: 'eau', differe: 1 }],
    ...champs,
  };
}

test('nouveauSortPerso donne un sort pret a calculer', () => {
  const sort = nouveauSortPerso([]);
  assert.ok(estSortPerso(sort));
  assert.equal(sort.lines.length, 1);
  assert.ok(computeSpell(sort, emptyStats()).average > 0);
});

test('chaque nouveau sort recoit un identifiant libre', () => {
  const premier = nouveauSortPerso([]);
  const second = nouveauSortPerso([premier, { id: 13244 }]);
  assert.notEqual(premier.id, second.id);
  assert.ok(estSortPerso(second));
});

test('un sort du catalogue n\'est pas un sort personnalise', () => {
  assert.equal(estSortPerso({ id: 13244 }), false);
  assert.equal(estSortPerso(null), false);
});

test('verifierSortPerso accepte un sort juste et le range', async (t) => {
  const { sort, erreurs } = verifierSortPerso(brouillon({ name: '  Mon combo  ' }));

  await t.test('aucune erreur', () => assert.deepEqual(erreurs, []));
  await t.test('le nom perd ses espaces de bord', () => assert.equal(sort.name, 'Mon combo'));
  await t.test('la ligne differee garde son tour', () => assert.equal(sort.lines[1].differe, 1));
  await t.test('les champs du moteur sont la', () => {
    assert.equal(sort.exclusiveGroup, null);
    assert.equal(sort.telefragCible, null);
    assert.equal(sort.lines[0].source, 'sort');
  });
});

test('verifierSortPerso refuse une saisie absurde, et dit quoi corriger', async (t) => {
  const refus = (champs) => verifierSortPerso(brouillon(champs)).erreurs;

  await t.test('un nom vide', () => assert.match(refus({ name: '   ' }).join(), /nom/i));
  await t.test('un cout hors du jeu', () => {
    assert.match(refus({ apCost: 0 }).join(), /PA/);
    assert.match(refus({ apCost: 20 }).join(), /PA/);
  });
  await t.test('aucune ligne', () => assert.match(refus({ lines: [] }).join(), /ligne/));
  await t.test('trop de lignes', () => {
    const lignes = Array.from({ length: MAX_LIGNES + 1 }, () => LIGNE);
    assert.match(refus({ lines: lignes }).join(), new RegExp(String(MAX_LIGNES)));
  });
  await t.test('un maximum sous le minimum nomme la ligne', () => {
    assert.match(refus({ lines: [{ ...LIGNE, min: 20, max: 10 }] }).join(), /ligne 1/);
  });
  await t.test('une ligne sans degats', () => {
    assert.match(refus({ lines: [{ ...LIGNE, min: 0, max: 0, critMin: 0, critMax: 0 }] }).join(), /ligne 1/);
  });
});

test('avecSortPerso remplace un sort a sa place, ou l\'ajoute a la fin', () => {
  const a = { id: 1 };
  const perso = verifierSortPerso(brouillon()).sort;
  const liste = avecSortPerso([a], perso);
  assert.deepEqual(liste.map((s) => s.id), [1, perso.id]);

  const renomme = { ...perso, name: 'Autre' };
  const suivante = avecSortPerso([...liste, { id: 2 }], renomme);
  assert.deepEqual(suivante.map((s) => s.id), [1, perso.id, 2]);
  assert.equal(suivante[1].name, 'Autre');
  assert.equal(liste[1].name, 'Mon combo', 'la liste recue ne change pas');
});

test('un sort personnalise fait l\'aller-retour du lien', () => {
  const { sort } = verifierSortPerso(brouillon());
  const compact = compacterSortPerso(sort);
  const relu = decompacterSortPerso(JSON.parse(JSON.stringify(compact)));

  assert.equal(relu.name, sort.name);
  assert.equal(relu.apCost, 3);
  assert.equal(relu.castsPerTurn, 2);
  assert.equal(relu.baseCrit, 10);
  assert.deepEqual(relu.lines.map((l) => [l.element, l.min, l.max, l.critMin, l.critMax, l.differe ?? 0]),
    [['feu', 10, 12, 13, 15, 0], ['eau', 10, 12, 13, 15, 1]]);
  assert.ok(estSortPerso(relu));
});

test('un sort abime dans le lien se refuse sans lever d\'erreur', () => {
  assert.equal(decompacterSortPerso(null), null);
  assert.equal(decompacterSortPerso(['', 3, 1, 0, []]), null);
  assert.equal(decompacterSortPerso(['X', 3, 1, 0, [[9, 1, 2, 3, 4, 0]]]), null);
});
