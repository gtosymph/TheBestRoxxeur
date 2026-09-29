/**
 * Le choix, sort par sort, de compter les degats des tours suivants et les
 * degats sous condition.
 *
 * Une seule option globale decidait pour tous les sorts : compter le Sablier
 * forcait a compter le Gousset. Chaque sort porte maintenant son choix, et
 * l'option globale ne sert plus que de valeur de depart.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { avecSpeciales, compteSpeciales, resumeSpeciales } from '../web/sorts-speciaux.mjs';
import { sortsCalcules } from '../web/objectif.mjs';
import { etatInitial } from '../web/reglages.mjs';

const COUP = { element: 'feu', min: 10, max: 12, critMin: 13, critMax: 15 };
const SABLIER = { id: 1, name: 'Sablier', lines: [COUP, { ...COUP, differe: 2 }] };
const AIGUILLE = {
  id: 2, name: 'Aiguille',
  lines: [{ ...COUP, differe: 1 }, { ...COUP, condition: 'Si la cible perd le Téléfrag' }],
};
const SIMPLE = { id: 3, name: 'Simple', lines: [COUP] };

test('resumeSpeciales dit ce que le sort garde de cote', async (t) => {
  await t.test('un sort ordinaire n\'a rien a dire', () => {
    assert.equal(resumeSpeciales(SIMPLE), null);
  });

  await t.test('un sort differe nomme le tour', () => {
    assert.match(resumeSpeciales(SABLIER).libelle, /T\+2/);
  });

  await t.test('un sort sous condition nomme la condition', () => {
    const resume = resumeSpeciales(AIGUILLE);
    assert.match(resume.libelle, /T\+1/);
    assert.match(resume.aide, /perd le Téléfrag/);
  });
});

test('compteSpeciales : le sort decide, l\'option donne le depart', () => {
  assert.equal(compteSpeciales(SABLIER, { toursSuivants: false }), false);
  assert.equal(compteSpeciales(SABLIER, { toursSuivants: true }), true);
  assert.equal(compteSpeciales({ ...SABLIER, speciales: true }, { toursSuivants: false }), true);
  assert.equal(compteSpeciales({ ...SABLIER, speciales: false }, { toursSuivants: true }), false);
});

test('avecSpeciales change un seul sort, sans toucher la liste recue', () => {
  const sorts = [SABLIER, AIGUILLE];
  const rendus = avecSpeciales(sorts, 2, true);
  assert.equal(rendus[1].speciales, true);
  assert.equal(rendus[0], SABLIER);
  assert.equal(AIGUILLE.speciales, undefined);
});

test('sortsCalcules suit le choix de chaque sort', () => {
  const etat = etatInitial();
  const [sablier, aiguille] = sortsCalcules({
    ...etat, niveau: 200, sorts: [SABLIER, { ...AIGUILLE, speciales: true }],
  });
  assert.equal(sablier.compterDiffere, false);
  assert.equal(sablier.compterCondition, false);
  assert.equal(aiguille.compterDiffere, true);
  assert.equal(aiguille.compterCondition, true);
});

test('plagesVariante montre le coup du tour et ce qui vient a part', async (t) => {
  const { plagesVariante } = await import('../web/sorts-speciaux.mjs');

  await t.test('un sort ordinaire montre sa plage seule', () => {
    assert.deepEqual(plagesVariante({ min: 10, max: 12, lines: [COUP] }), { tour: '10–12', aPart: null });
  });

  await t.test('Aiguille ne montre plus 0–0', () => {
    // Ses deux coups sont a part : un poison au tour suivant, un coup sous
    // condition. « 0–0 » laissait croire que le sort ne faisait rien.
    assert.deepEqual(plagesVariante({ min: 0, max: 0, lines: AIGUILLE.lines }), { tour: '—', aPart: '+20–24' });
  });

  await t.test('le Sablier montre les deux', () => {
    assert.deepEqual(plagesVariante({ min: 10, max: 12, lines: SABLIER.lines }), { tour: '10–12', aPart: '+10–12' });
  });
});
