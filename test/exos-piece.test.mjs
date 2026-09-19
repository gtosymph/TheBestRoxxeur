import test from 'node:test';
import assert from 'node:assert/strict';

import {
  basculerExoRare, decrireExos, exosPortes, lignesAvecExos, mettreOver, poserExosLibres,
} from '../web/exos-piece.mjs';

const ceinture = { id: 10, fr: 'Ceinture', slot: 'ceinture', stats: { vitalite: 300, force: 80 } };

test('basculerExoRare : un seul exo rare par piece', () => {
  const un = basculerExoRare({}, 10, 'pa');
  assert.deepEqual(un, { 10: { pa: 1 } });

  const autre = basculerExoRare(un, 10, 'pm');
  assert.deepEqual(autre, { 10: { pm: 1 } }, 'le PM remplace le PA');

  const rien = basculerExoRare(autre, 10, 'pm');
  assert.deepEqual(rien, {}, 'recliquer enleve l exo et la piece vide disparait');
});

test('basculerExoRare : refuse la ligne que la piece porte deja', () => {
  const anneau = { id: 11, stats: { pa: 1 } };
  assert.throws(() => basculerExoRare({}, anneau.id, 'pa', anneau), /porte déjà/);
});

test('mettreOver : une valeur par ligne, zero efface', () => {
  const avec = mettreOver({ 10: { pa: 1 } }, 10, 'vitalite', 50);
  assert.deepEqual(avec, { 10: { pa: 1, over: { vitalite: 50 } } });

  const sans = mettreOver(avec, 10, 'vitalite', 0);
  assert.deepEqual(sans, { 10: { pa: 1 } });

  const vide = mettreOver(mettreOver({}, 10, 'force', 5), 10, 'force', '');
  assert.deepEqual(vide, {});
});

test('mettreOver : l entree reste intacte', () => {
  const entree = { 10: { over: { vitalite: 10 } } };
  mettreOver(entree, 10, 'vitalite', 99);
  assert.deepEqual(entree, { 10: { over: { vitalite: 10 } } });
});

test('lignesAvecExos : les lignes de la piece, exos marques', () => {
  const lignes = lignesAvecExos(ceinture, { pa: 1, over: { vitalite: 50 } });
  assert.deepEqual(lignes, [
    { cle: 'vitalite', valeur: 350, base: 300, exo: 50 },
    { cle: 'force', valeur: 80, base: 80, exo: 0 },
    { cle: 'pa', valeur: 1, base: 0, exo: 1 },
  ]);
});

test('poserExosLibres : ce que le solveur a pose devient exo du joueur', () => {
  const exos = poserExosLibres({ 10: { over: { vitalite: 20 } } }, [{ id: 10, cle: 'pa' }, { id: 12, cle: 'pm' }]);
  assert.deepEqual(exos, { 10: { over: { vitalite: 20 }, pa: 1 }, 12: { pm: 1 } });
  assert.deepEqual(poserExosLibres({ 10: { pa: 1 } }, []), { 10: { pa: 1 } });
});

test('exosPortes : seuls les exos des pieces portees comptent', () => {
  const exos = { 10: { pa: 1 }, 99: { pm: 1 } };
  assert.deepEqual(exosPortes(exos, [ceinture]), [{ id: 10, cle: 'pa' }]);
});

test('decrireExos : une phrase que le joueur lit', () => {
  const itemById = new Map([[10, ceinture], [12, { id: 12, fr: 'Bottes', slot: 'bottes' }]]);
  assert.equal(decrireExos([{ id: 10, cle: 'pa' }], itemById), 'avec un exo PA sur la ceinture');
  assert.equal(decrireExos([{ id: 10, cle: 'pa' }, { id: 12, cle: 'po' }], itemById),
    'avec un exo PA sur la ceinture et un exo portée sur les bottes');
  assert.equal(decrireExos([], itemById), '');
});
