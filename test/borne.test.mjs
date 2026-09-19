import test from 'node:test';
import assert from 'node:assert/strict';

import { borneDegats, statsRelachees } from '../src/solver/borne.mjs';
import { damageValue } from '../src/solver/score.mjs';
import { aggregate, derive } from '../src/engine/build.mjs';
import { availablePoints, maxForBudget } from '../src/engine/characteristics.mjs';

const item = (id, slot, stats, extra = {}) => ({ id, slot, level: 1, fr: `#${id}`, stats, ...extra });
const CATALOGUE = [
  item(1, 'amulette', { force: 30, intelligence: 50 }),
  item(2, 'amulette', { force: 40 }),
  item(3, 'anneau', { force: 10, puissance: 20 }, { setId: 7 }),
  item(4, 'anneau', { force: 25 }),
  item(5, 'anneau', { force: 999 }, { level: 200 }),
  item(6, 'anneau', { force: 500 }, { criteria: 'PX>0' }),
];
const SETS = new Map([[7, { id: 7, fr: 'Pano', tiers: [{}, { force: 15 }, { force: 60 }] }]]);
const SORT = { lines: [{ element: 'terre', min: 100, max: 100 }] };

test('chaque emplacement prend le meilleur de chaque statistique, sur des pieces distinctes', () => {
  const stats = statsRelachees({ items: CATALOGUE, level: 1, setById: SETS });
  // Amulette : 40 de force, 50 d'intelligence. Deux anneaux : les deux
  // meilleures forces (25 et 10), la seule puissance (20). Panoplie : le
  // palier le plus haut, 60.
  assert.equal(stats.force, 40 + 25 + 10 + 60);
  assert.equal(stats.intelligence, 50);
  assert.equal(stats.puissance, 20);
});

test('les pieces trop hautes, bannies ou hors jeu ne comptent pas', () => {
  const stats = statsRelachees({ items: CATALOGUE, level: 1, setById: SETS, banned: new Set([4]) });
  assert.equal(stats.force, 40 + 10 + 60);
});

test('tous les points vont dans chaque caracteristique a la fois', () => {
  const stats = statsRelachees({ items: [], level: 100, setById: new Map() });
  const budget = availablePoints(100);
  assert.equal(stats.force, maxForBudget('force', budget));
  assert.equal(stats.chance, maxForBudget('chance', budget));
});

test('la borne depasse tout build reel et compte la cible', () => {
  const objective = { spells: [SORT], conditions: [], cible: { terre: 50 } };
  const borne = borneDegats({ items: CATALOGUE, level: 1, setById: SETS, objective });

  const reel = aggregate({ items: [CATALOGUE[1], CATALOGUE[2], CATALOGUE[3]], level: 1 }, SETS);
  const degatsReels = damageValue([SORT], derive(reel.stats, 1), { terre: 50 }).total;
  assert.ok(borne > degatsReels, `${borne} doit depasser ${degatsReels}`);

  const sansCible = borneDegats({ items: CATALOGUE, level: 1, setById: SETS, objective: { ...objective, cible: null } });
  assert.ok(sansCible > borne, 'la cible qui resiste abaisse la borne');
});

test('sans sort, pas de borne', () => {
  assert.equal(borneDegats({ items: CATALOGUE, level: 1, setById: SETS, objective: { spells: [], conditions: [] } }), null);
});
