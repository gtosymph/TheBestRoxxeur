/**
 * Ce que le fichier des sorts LIVRE dit.
 *
 * La regle de lecture vit dans src/data/lignes-sorts.mjs, et elle est testee.
 * Cela n'a pourtant pas suffi : le fichier data/spells.json se regenere a la
 * main, et une version perimee a ete livree avec la regle corrigee. La regle
 * etait juste, les donnees mentaient quand meme, et personne ne le voyait.
 *
 * Ces temoins lisent donc le fichier livre, pas la regle. Ils tombent des que
 * les deux cessent d'etre d'accord.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const classes = JSON.parse(await readFile(new URL('../data/spells.json', import.meta.url), 'utf8'));

/** Retrouve un sort par son nom, toutes classes confondues. */
function sort(nom) {
  for (const classe of classes) {
    const trouve = (classe.spells ?? []).find((s) => s.fr === nom);
    if (trouve) return trouve;
  }
  return null;
}

test('les donnees livrees', async (t) => {
  await t.test('Pendule ne porte son coup qu une fois', () => {
    // Le jeu l'ecrit sur la fiche du sort : « les effets ne sont appliques
    // qu'une seule fois par lancer ». La cible et la zone sont le meme coup.
    const pendule = sort('Pendule');
    assert.ok(pendule, 'Pendule est au catalogue');
    assert.deepEqual(pendule.lines, [
      { element: 'air', min: 33, max: 36, critMin: 40, critMax: 43 },
    ]);
  });

  await t.test('les sorts qui poussent gardent leur poussee', () => {
    const souffle = sort('Souffle');
    assert.ok(souffle, 'Souffle est au catalogue');
    assert.ok((souffle.lines ?? []).some((l) => l.element === 'poussee'),
      'la poussee compte dans les degats');
  });

  await t.test('aucun sort ne compte deux fois le meme coup en zone', () => {
    for (const nom of ['Épidémie', 'Vacarme', 'Cryothérapie', 'Cascade', 'Moulin Rouge']) {
      const s = sort(nom);
      if (!s) continue;
      const degats = (s.lines ?? []).filter((l) => l.element !== 'poussee');
      const cles = degats.map((l) => `${l.element}|${l.min}|${l.max}`);
      assert.equal(new Set(cles).size, cles.length, `${nom} compte deux fois le meme coup`);
    }
  });
});
