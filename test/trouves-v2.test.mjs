import test from 'node:test';
import assert from 'node:assert/strict';

import { notesDesTrouves } from '../web/v2/trouves.mjs';

test('la liste vide dit pourquoi elle est vide', async (t) => {
  await t.test('sans recherche, elle invite a en lancer une', () => {
    const { vide } = notesDesTrouves([], { enRecherche: false });
    assert.match(vide, /Lancez une recherche/);
  });

  await t.test('pendant une recherche, elle ne demande pas d\'en lancer une', () => {
    // La liste se vide au depart et ne se remplit qu'a la pause : « Lancez
    // une recherche » pendant qu'elle tourne se lisait comme une panne.
    const { vide } = notesDesTrouves([], { enRecherche: true });
    assert.doesNotMatch(vide, /Lancez/);
    assert.match(vide, /pause/);
  });
});

test('une liste ou aucun build ne tient les minimums le dit', async (t) => {
  await t.test('tous les builds manquent un minimum : un avertissement nomme le reglage', () => {
    const { avertissement } = notesDesTrouves(
      [{ satisfied: false }, { satisfied: false }], { enRecherche: false });
    assert.match(avertissement, /minimums/);
    assert.match(avertissement, /Au minimum/);
  });

  await t.test('un seul build tenu suffit a taire l\'avertissement', () => {
    const { avertissement } = notesDesTrouves(
      [{ satisfied: false }, { satisfied: true }], { enRecherche: false });
    assert.equal(avertissement, null);
  });

  await t.test('sans minimum demande, rien a signaler', () => {
    // `satisfied` absent : le moteur n'avait aucune condition a verifier.
    const { avertissement } = notesDesTrouves([{}, {}], { enRecherche: false });
    assert.equal(avertissement, null);
  });

  await t.test('une liste vide n\'avertit de rien', () => {
    assert.equal(notesDesTrouves([], { enRecherche: false }).avertissement, null);
  });
});
