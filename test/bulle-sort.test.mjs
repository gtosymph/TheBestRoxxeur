/**
 * Ce que l'infobulle d'un sort dit.
 *
 * Trois questions, trois reponses : ce que le sort coute, ce qu'il frappe, et
 * ce qu'il rapporte avec le stuff porte. La troisieme est la seule qui demande
 * un calcul, et c'est la seule qui aide vraiment a choisir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { coutDuSort, decrireSort, lignesDuSort, renduDuSort } from '../web/bulle-sort.mjs';

const PENDULE = {
  id: 13294, name: 'Pendule', apCost: 4, castsPerTurn: 2, baseCrit: 15,
  lines: [{ element: 'air', min: 33, max: 36, critMin: 40, critMax: 43, source: 'sort', range: 'melee' }],
};

const FICHE = { range: 4, minRange: 0, zone: 'cercle 2' };

test('le cout d un sort', async (t) => {
  await t.test('il dit les PA, la portee, les lancers et le critique', () => {
    assert.deepEqual(coutDuSort(PENDULE, FICHE), [
      '4 PA', 'portée 0–4', '2 lancers max par tour', '15 % de critique', 'zone cercle 2',
    ]);
  });

  await t.test('sans fiche, la portee se tait', () => {
    assert.deepEqual(coutDuSort(PENDULE), ['4 PA', '2 lancers max par tour', '15 % de critique']);
  });

  await t.test('un seul lancer se dit au singulier', () => {
    assert.ok(coutDuSort({ apCost: 3, castsPerTurn: 1 }).includes('1 lancer par tour'));
  });

  await t.test('une portee fixe ne s ecrit pas en intervalle', () => {
    assert.ok(coutDuSort(PENDULE, { range: 1, minRange: 1 }).includes('portée 1'));
  });
});

test('les lignes d un sort', async (t) => {
  await t.test('chaque ligne dit son element, son coup et son critique', () => {
    assert.deepEqual(lignesDuSort(PENDULE), [
      { element: 'air', normal: '33–36', critique: '40–43', differe: 0 },
    ]);
  });

  await t.test('une ligne aux bornes egales ne montre qu un chiffre', () => {
    const fixe = { lines: [{ element: 'feu', min: 50, max: 50, critMin: 60, critMax: 60 }] };
    assert.deepEqual(lignesDuSort(fixe), [
      { element: 'feu', normal: '50', critique: '60', differe: 0 },
    ]);
  });

  await t.test('une ligne differee garde son delai', () => {
    const differe = { lines: [{ element: 'eau', min: 10, max: 12, differe: 1 }] };
    assert.equal(lignesDuSort(differe)[0].differe, 1);
  });

  await t.test('un sort sans ligne rend une liste vide', () => {
    assert.deepEqual(lignesDuSort({}), []);
    assert.deepEqual(lignesDuSort(null), []);
  });
});

test('ce que le sort rapporte ici', async (t) => {
  await t.test('sans statistiques, il n y a rien a dire', () => {
    assert.equal(renduDuSort(PENDULE, null), null);
  });

  await t.test('l agilite fait monter un sort d air', () => {
    const nu = renduDuSort(PENDULE, { agilite: 0 });
    const monte = renduDuSort(PENDULE, { agilite: 800 });
    assert.ok(monte.moyenne > nu.moyenne);
  });

  await t.test('le tour compte les lancers CHOISIS, pas la limite du jeu', () => {
    const unSeul = renduDuSort(PENDULE, { agilite: 400 });
    assert.equal(unSeul.parTour, unSeul.moyenne, 'sans choix, un seul lancer compte');

    const deux = renduDuSort({ ...PENDULE, repeats: 2 }, { agilite: 400 });
    assert.equal(deux.parTour, deux.moyenne * 2);
    assert.equal(deux.comptes, 2);
  });

  await t.test('les degats par PA divisent par le cout', () => {
    const rendu = renduDuSort(PENDULE, { agilite: 400 });
    assert.equal(rendu.parPa, rendu.moyenne / 4);
  });

  await t.test('une cible resistante fait baisser le rendu', () => {
    const nue = renduDuSort(PENDULE, { agilite: 400 });
    const blindee = renduDuSort(PENDULE, { agilite: 400 }, { air: 50 });
    assert.ok(blindee.moyenne < nue.moyenne);
  });
});

test('la description complete', async (t) => {
  await t.test('elle reunit le nom, le cout, les lignes et le rendu', () => {
    const vue = decrireSort(PENDULE, { stats: { agilite: 400 }, fiche: FICHE });
    assert.equal(vue.nom, 'Pendule');
    assert.equal(vue.cout[0], '4 PA');
    assert.equal(vue.lignes.length, 1);
    assert.ok(vue.rendu.moyenne > 0);
    assert.ok(vue.phrases.some((p) => p.includes('par lancer')));
    assert.ok(vue.phrases.some((p) => p.includes('par PA')));
    assert.ok(vue.phrases.some((p) => p.includes('lancers possibles')));
  });

  await t.test('sans stuff, elle dit le sort sans rien promettre', () => {
    const vue = decrireSort(PENDULE);
    assert.equal(vue.rendu, null);
    assert.deepEqual(vue.phrases, []);
    assert.equal(vue.lignes.length, 1);
  });

  await t.test('un sort a un seul lancer ne parle pas du tour', () => {
    const unique = { ...PENDULE, castsPerTurn: 1 };
    const vue = decrireSort(unique, { stats: { agilite: 400 } });
    assert.equal(vue.phrases.filter((p) => p.includes('lancer')).length, 1);
    assert.ok(vue.phrases.some((p) => p.includes('par lancer')));
  });

  await t.test('deux lancers choisis se disent dans le total du tour', () => {
    const vue = decrireSort({ ...PENDULE, repeats: 2 }, { stats: { agilite: 400 } });
    assert.ok(vue.phrases.some((p) => p.includes('sur le tour, à 2 lancers')));
  });

  await t.test('sans sort, il n y a rien a decrire', () => {
    assert.equal(decrireSort(null), null);
  });
});
