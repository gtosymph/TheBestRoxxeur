/**
 * Le journal des versions.
 *
 * Il ne peut pas se tromper sans qu'on le voie — sauf sur un point : une
 * version montee sans ligne de journal. L'ecran montrerait alors « v1.9.0 »
 * et un journal qui s'arrete a 1.8.0, sans la moindre erreur. Ce test-la est
 * la seule raison pour laquelle ce fichier existe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { comparerVersions, dateLue, entreeDe, JOURNAL, versionsDuJournal } from '../web/v2/journal.mjs';
import { VERSION } from '../web/version.mjs';

test('le journal des versions', async (t) => {
  await t.test('la version publiee y figure, et elle ouvre la liste', () => {
    assert.equal(JOURNAL[0].version, VERSION,
      'montez le journal en meme temps que la version');
  });

  await t.test('les versions vont de la plus recente a la plus ancienne', () => {
    for (let i = 1; i < JOURNAL.length; i += 1) {
      assert.ok(comparerVersions(JOURNAL[i - 1].version, JOURNAL[i].version) > 0,
        `${JOURNAL[i - 1].version} devrait venir apres ${JOURNAL[i].version}`);
    }
  });

  await t.test('la premiere version du projet ferme la liste', () => {
    assert.equal(JOURNAL[JOURNAL.length - 1].version, '1.0.0');
  });

  await t.test('chaque numero n apparait qu une fois', () => {
    const versions = versionsDuJournal();
    assert.equal(new Set(versions).size, versions.length);
  });

  await t.test('chaque entree porte une date, un titre et au moins un point', () => {
    for (const entree of JOURNAL) {
      assert.match(entree.date, /^\d{4}-\d{2}-\d{2}$/, `${entree.version} : date illisible`);
      assert.ok(entree.titre.length > 0, `${entree.version} : titre vide`);
      assert.ok(entree.points.length > 0, `${entree.version} : aucun point`);
      for (const point of entree.points) {
        assert.equal(typeof point, 'string');
        assert.ok(point.length > 0);
      }
    }
  });

  await t.test('une version se retrouve par son numero', () => {
    assert.equal(entreeDe('1.0.0').titre, 'La première version');
    assert.equal(entreeDe('0.1.0'), null);
  });
});

test('comparer deux versions', async (t) => {
  await t.test('le majeur passe avant le mineur', () => {
    assert.ok(comparerVersions('2.0.0', '1.9.9') > 0);
  });

  await t.test('le mineur passe avant le correctif', () => {
    assert.ok(comparerVersions('1.2.0', '1.1.9') > 0);
  });

  await t.test('deux fois le meme numero ne se departagent pas', () => {
    assert.equal(comparerVersions('1.4.0', '1.4.0'), 0);
  });

  await t.test('dix vient apres neuf, et non avant', () => {
    assert.ok(comparerVersions('1.10.0', '1.9.0') > 0);
  });
});

test('la date se lit a la francaise', () => {
  assert.equal(dateLue('2026-09-21'), '21/09/2026');
});
