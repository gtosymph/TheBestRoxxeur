import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXOS_RARES, PLAFONDS, normaliserExos, placerExos, statsExo,
} from '../src/engine/exos.mjs';
import { aggregate, computeBuild, derive } from '../src/engine/build.mjs';
import { STAT_KEYS } from '../src/data/stats.mjs';

const KNOWN = new Set(STAT_KEYS);
const setById = new Map();

const ceinture = { id: 10, slot: 'ceinture', stats: { vitalite: 300, force: 80 } };
const anneau = { id: 11, slot: 'anneau', stats: { pa: 1, force: 40 } };
const bottes = { id: 12, slot: 'bottes', stats: { pm: 1, vitalite: 200 } };
const cape = { id: 13, slot: 'cape', stats: { po: 1, chance: 50 } };
const amulette = { id: 14, slot: 'amulette', stats: { vitalite: 250 } };

test('statsExo : lignes ajoutees par la forgemagie d une piece', async (t) => {
  await t.test('un exo rare vaut un point de sa mesure', () => {
    assert.deepEqual(statsExo({ pa: 1 }), { pa: 1 });
    assert.deepEqual(statsExo({ po: 1 }), { po: 1 });
  });

  await t.test('l over s ajoute ligne par ligne, les zeros disparaissent', () => {
    assert.deepEqual(statsExo({ pm: 1, over: { vitalite: 50, force: 0 } }), { pm: 1, vitalite: 50 });
  });

  await t.test('rien ne rend rien', () => {
    assert.deepEqual(statsExo(null), {});
    assert.deepEqual(statsExo({}), {});
  });
});

test('normaliserExos : la configuration du joueur devient une table par piece', async (t) => {
  await t.test('les pieces sans apport sont ecartees, les mesures inconnues aussi', () => {
    const exos = normaliserExos({
      10: { pa: 1, over: { vitalite: 40, inconnue: 9 } },
      11: {},
      abc: { pm: 1 },
    }, KNOWN);
    assert.deepEqual([...exos.entries()], [[10, { pa: 1, vitalite: 40 }]]);
  });

  await t.test('une configuration absente rend une table vide', () => {
    assert.equal(normaliserExos(null, KNOWN).size, 0);
  });
});

test('aggregate : les exos suivent la piece', async (t) => {
  const exos = normaliserExos({ 10: { pa: 1, over: { vitalite: 100 } } }, KNOWN);

  await t.test('la piece portee apporte ses exos', () => {
    const { stats } = aggregate({ items: [ceinture], level: 190, exos }, setById);
    assert.equal(stats.pa, 1);
    assert.equal(stats.vitalite, 400);
  });

  await t.test('une autre piece dans la meme case n apporte rien', () => {
    const { stats } = aggregate({ items: [amulette], level: 190, exos }, setById);
    assert.equal(stats.pa, 0);
    assert.equal(stats.vitalite, 250);
  });
});

test('derive : le jeu plafonne PA, PM et portee', () => {
  const stats = derive({ pa: 8, pm: 5, po: 9 }, 190);
  assert.equal(stats.pa, PLAFONDS.pa);
  assert.equal(stats.pm, PLAFONDS.pm);
  assert.equal(stats.po, PLAFONDS.po);
});

test('placerExos : le solveur pose les exos libres ou ils rapportent', async (t) => {
  const bases = { pa: 7, pm: 3, po: 0 };

  await t.test('un exo PA va sur une piece sans PA natif ni exo rare', () => {
    const { raw, places } = placerExos({
      items: [anneau, ceinture], raw: { pa: 1 }, bases,
      budget: { pa: 1, pm: 0, po: 0 }, exos: new Map(),
    });
    assert.equal(raw.pa, 2);
    assert.deepEqual(places, [{ id: 10, cle: 'pa' }]);
  });

  await t.test('une piece ne recoit qu un exo rare', () => {
    const { places } = placerExos({
      items: [ceinture], raw: {}, bases,
      budget: { pa: 1, pm: 1, po: 0 }, exos: new Map(),
    });
    assert.equal(places.length, 1);
  });

  await t.test('une piece deja exo par le joueur est passee', () => {
    const exos = new Map([[10, { pm: 1 }]]);
    const { places } = placerExos({
      items: [ceinture, anneau], raw: { pa: 1, pm: 1 }, bases,
      budget: { pa: 1, pm: 0, po: 0 }, exos,
    });
    // L'anneau porte du PA natif, la ceinture porte deja un exo : personne.
    assert.deepEqual(places, []);
  });

  await t.test('le plafond du jeu borne ce qui se pose', () => {
    const { raw, places } = placerExos({
      items: [ceinture, amulette, cape], raw: { pa: 4 }, bases,
      budget: { pa: 3, pm: 0, po: 0 }, exos: new Map(),
    });
    // 7 de base + 4 : il ne reste qu'un point avant 12.
    assert.equal(raw.pa, 5);
    assert.equal(places.length, 1);
  });

  await t.test('sans budget, rien ne bouge et l entree reste intacte', () => {
    const entree = { pa: 1 };
    const { raw, places } = placerExos({
      items: [ceinture], raw: entree, bases, budget: null, exos: new Map(),
    });
    assert.deepEqual(places, []);
    assert.equal(raw, entree);
  });

  await t.test('les trois mesures se posent chacune sur une piece differente', () => {
    const { places } = placerExos({
      items: [ceinture, amulette, bottes, cape, anneau], raw: {}, bases,
      budget: { pa: 1, pm: 1, po: 1 }, exos: new Map(),
    });
    assert.equal(places.length, 3);
    assert.equal(new Set(places.map((p) => p.id)).size, 3);
    assert.deepEqual(places.map((p) => p.cle).sort(), [...EXOS_RARES].sort());
  });
});

test('computeBuild : les exos libres entrent dans les statistiques finales', () => {
  const build = computeBuild({
    items: [ceinture, amulette], level: 190,
    exos: normaliserExos({ 14: { pm: 1 } }, KNOWN),
    exosLibres: { pa: 1, pm: 0, po: 0 },
  }, setById);
  assert.equal(build.stats.pa, 8);
  assert.equal(build.stats.pm, 4);
  assert.deepEqual(build.exos, [{ id: 10, cle: 'pa' }]);
});
