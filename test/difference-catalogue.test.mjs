import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparer, resumeMarkdown } from '../src/data/difference-catalogue.mjs';

const avant = [
  { id: 1, fr: 'Coiffe du Bouftou', level: 20 },
  { id: 2, fr: 'Cape du Bouftou', level: 20 },
  { id: 3, fr: 'Anneau perdu', level: 50 },
];

test('comparer compte les ajouts, les retraits et les modifications par id', () => {
  const apres = [
    { id: 1, fr: 'Coiffe du Bouftou', level: 20 },
    { id: 2, fr: 'Cape du Bouftou', level: 21 },
    { id: 4, fr: 'Amulette neuve', level: 200 },
  ];
  const d = comparer(avant, apres);
  assert.deepEqual(d.ajoutes.map((e) => e.id), [4]);
  assert.deepEqual(d.enleves.map((e) => e.id), [3]);
  assert.deepEqual(d.modifies.map((e) => e.id), [2]);
  assert.equal(d.inchanges, 1);
});

test('comparer ignore l ordre des cles et l ordre des entrees', () => {
  const apres = [
    { level: 50, fr: 'Anneau perdu', id: 3 },
    { fr: 'Cape du Bouftou', id: 2, level: 20 },
    { id: 1, level: 20, fr: 'Coiffe du Bouftou' },
  ];
  const d = comparer(avant, apres);
  assert.equal(d.modifies.length, 0);
  assert.equal(d.inchanges, 3);
});

test('comparer refuse autre chose qu un tableau', () => {
  assert.throws(() => comparer(null, avant), /tableau/);
  assert.throws(() => comparer(avant, {}), /tableau/);
});

test('resumeMarkdown dit en une ligne quand rien ne change', () => {
  const texte = resumeMarkdown({ objets: comparer(avant, avant) });
  assert.match(texte, /objets : aucun changement/);
});

test('resumeMarkdown nomme les entrees et coupe les longues listes', () => {
  const apres = avant.map((e) => ({ ...e, level: e.level + 1 }));
  const beaucoup = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, fr: `Objet ${i}` }));
  const texte = resumeMarkdown({ objets: comparer(avant, [...apres, ...beaucoup]) }, { maxNoms: 5 });
  assert.match(texte, /30 ajoutes/);
  assert.match(texte, /3 modifies/);
  assert.match(texte, /Cape du Bouftou/);
  assert.match(texte, /et 25 autres/);
});
