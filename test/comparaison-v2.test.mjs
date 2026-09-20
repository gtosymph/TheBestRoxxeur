/**
 * La comparaison de plusieurs stuffs.
 *
 * Elle repose sur une seule regle : ce qui ne change pas n'aide pas a choisir.
 * Deux pieges la guettent. Masquer sans compter laisse le joueur incapable de
 * savoir s'il regarde un extrait ou le tout ; et lire un minimum en ecart
 * repond a la mauvaise question — ce qui compte d'un minimum est s'il est
 * tenu, pas s'il a monte de trois.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  libellesExos, libellesForge, lignesComparaison, mesuresDegats, nomDeColonne, ordonnerPieces, valeursDegats,
} from '../web/v2/comparaison.mjs';

const MESURES = [
  { cle: 'pa', libelle: 'PA' },
  { cle: 'pm', libelle: 'PM' },
  { cle: 'force', libelle: 'Force' },
  { cle: 'sagesse', libelle: 'Sagesse' },
];

const COLONNES = [
  { nom: 'Porte', stats: { pa: 12, pm: 6, force: 900, sagesse: 300 } },
  { nom: 'Trouve 1', stats: { pa: 12, pm: 6, force: 980, sagesse: 300 } },
  { nom: 'Trouvé 2', stats: { pa: 11, pm: 6, force: 940, sagesse: 300 } },
];

const cles = (r) => r.lignes.map((l) => l.cle);

test('masquage des lignes identiques', async (t) => {
  await t.test('une mesure identique partout disparait', () => {
    const r = lignesComparaison(MESURES, COLONNES);
    assert.deepEqual(cles(r), ['pa', 'force']);
  });

  await t.test('le compte des masquees est dit', () => {
    assert.equal(lignesComparaison(MESURES, COLONNES).masquees, 2);
  });

  await t.test('on peut tout rappeler', () => {
    const r = lignesComparaison(MESURES, COLONNES, { masquerIdentiques: false });
    assert.deepEqual(cles(r), ['pa', 'pm', 'force', 'sagesse']);
    assert.equal(r.masquees, 0);
  });

  await t.test('une seule colonne ne fait varier personne', () => {
    const r = lignesComparaison(MESURES, [COLONNES[0]]);
    assert.deepEqual(cles(r), []);
    assert.equal(r.masquees, 4);
  });

  await t.test('aucune colonne ne casse rien', () => {
    assert.deepEqual(lignesComparaison(MESURES, []), { lignes: [], masquees: 0 });
  });
});

test('les deux lectures', async (t) => {
  await t.test('une mesure ordinaire se lit en ecart face au stuff porte', () => {
    const force = lignesComparaison(MESURES, COLONNES).lignes.find((l) => l.cle === 'force');
    assert.deepEqual(force.cellules.map((c) => c.ecart), [null, 80, 40]);
    assert.equal(force.absolue, false);
  });

  await t.test('un minimum se lit en valeur absolue, jamais en ecart', () => {
    const r = lignesComparaison(MESURES, COLONNES, { minimums: new Set(['pa']) });
    const pa = r.lignes.find((l) => l.cle === 'pa');
    assert.equal(pa.absolue, true);
    assert.deepEqual(pa.cellules.map((c) => c.ecart), [null, null, null]);
    assert.deepEqual(pa.cellules.map((c) => c.valeur), [12, 12, 11]);
  });

  await t.test('la colonne de reference n\'a pas d\'ecart avec elle-meme', () => {
    const force = lignesComparaison(MESURES, COLONNES).lignes.find((l) => l.cle === 'force');
    assert.equal(force.cellules[0].ecart, null);
  });

  await t.test('une mesure absente d\'un stuff vaut zero, pas undefined', () => {
    const r = lignesComparaison([{ cle: 'soins', libelle: 'Soins' }],
      [COLONNES[0], { nom: 'x', stats: { soins: 20 } }], { masquerIdentiques: false });
    assert.deepEqual(r.lignes[0].cellules.map((c) => c.valeur), [0, 20]);
    assert.equal(r.lignes[0].cellules[1].ecart, 20);
  });
});

test('nom de colonne', () => {
  assert.equal(nomDeColonne(0), 'Porte');
  assert.equal(nomDeColonne(2), 'Trouvé 2');
});

test('les degats entrent dans la comparaison', async (t) => {
  const sorts = [{ name: 'Pression' }, { name: 'Colère' }];

  await t.test('une mesure pour le total, une par sort, une pour l\'arme si elle compte', () => {
    const mesures = mesuresDegats(sorts, true);
    assert.deepEqual(mesures.map((m) => m.cle), ['degats', 'sort:0', 'sort:1', 'arme']);
    assert.deepEqual(mesures.map((m) => m.libelle), ['Dégâts par tour', 'Pression', 'Colère', 'Arme']);
    assert.ok(mesures.every((m) => m.famille === 'Dégâts'));
    assert.equal(mesuresDegats(sorts, false).length, 3, 'sans arme comptee, pas de ligne arme');
  });

  await t.test('les valeurs viennent du detail des degats, arme apres les sorts', () => {
    const detail = { total: 1300, perSpell: [
      { average: 400, repeats: 1 }, { average: 300, repeats: 1 }, { average: 200, repeats: 3 },
    ] };
    assert.deepEqual(valeursDegats(detail, 2, true),
      { degats: 1300, 'sort:0': 400, 'sort:1': 300, arme: 600 });
    assert.deepEqual(valeursDegats(detail, 2, false), { degats: 1300, 'sort:0': 400, 'sort:1': 300 });
  });

  await t.test('un detail vide donne des zeros, pas des trous', () => {
    assert.deepEqual(valeursDegats(null, 1, false), { degats: 0, 'sort:0': 0 });
  });
});

test('les pieces d\'une colonne se rangent comme sur le plateau', () => {
  const pieces = [
    { id: 1, slot: 'bottes' }, { id: 2, slot: 'amulette' }, { id: 3, slot: 'artefact' }, { id: 4, slot: 'arme' },
  ];
  assert.deepEqual(ordonnerPieces(pieces).map((p) => p.id), [2, 4, 1, 3]);
  assert.deepEqual(ordonnerPieces(null), []);
});

test('libellesExos nomme chaque exo rare et chaque over, dans l ordre des pieces', () => {
  const pieces = [
    { id: 1, slot: 'amulette', fr: 'Amu' },
    { id: 2, slot: 'anneau', fr: 'Bague' },
    { id: 3, slot: 'ceinture', fr: 'Ceinture' },
  ];
  const exos = {
    3: { pa: 1 },
    2: { over: { vitalite: 30, force: -2 } },
  };
  assert.deepEqual(libellesExos(exos, pieces), [
    'Vitalité +30 · Anneau',
    'Force −2 · Anneau',
    'Exo PA · Ceinture',
  ]);
});

test('libellesExos rend une liste vide sans exo ou sans piece', () => {
  assert.deepEqual(libellesExos({}, [{ id: 1, slot: 'cape' }]), []);
  assert.deepEqual(libellesExos(null, []), []);
  assert.deepEqual(libellesExos({ 9: { pm: 1 } }, [{ id: 1, slot: 'cape' }]), []);
});

test('libellesForge lit la table normalisee, overs puis exos rares', () => {
  const pieces = [
    { id: 1, slot: 'amulette', fr: 'Amu' },
    { id: 2, slot: 'ceinture', fr: 'Ceinture' },
  ];
  const table = new Map([
    [1, { intelligence: 101 }],
    [2, { pa: 1, vitalite: 50 }],
  ]);
  assert.deepEqual(libellesForge(table, pieces), [
    'Intelligence +101 · Amulette',
    'Vitalité +50 · Ceinture',
    'Exo PA · Ceinture',
  ]);
});

test('libellesForge rend une liste vide sans table ni piece', () => {
  assert.deepEqual(libellesForge(null, [{ id: 1, slot: 'cape' }]), []);
  assert.deepEqual(libellesForge(new Map(), [{ id: 1, slot: 'cape' }]), []);
  assert.deepEqual(libellesForge(new Map([[9, { force: 10 }]]), [{ id: 1, slot: 'cape' }]), []);
});
