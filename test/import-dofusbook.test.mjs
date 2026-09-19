import assert from 'node:assert/strict';
import test from 'node:test';

import { ecrire, lire } from '../src/partage/msgpack.mjs';
import { lienDofusbook } from '../src/partage/dofusbook.mjs';
import { lireLienDofusbook } from '../src/partage/dofusbook-import.mjs';
import { reconnaitreNoms } from '../src/partage/import-texte.mjs';

/** Pieces portees, telles que l'interface les range : `emplacement:rang`. */
const porter = (paires) => new Map(paires.map(([cle, id]) => [cle, { id }]));

test('lire : relit ce que ecrire a ecrit, entiers, chaines, tableaux, tables', () => {
  const valeur = { 0: { 2: 300, 6: 7 }, 1: [0, 0, 300, 0, 0, 0], 2: 200, 3: 0, 4: { 5: 2, 6: 6 }, 5: new Array(16).fill(0).map((_, i) => i * 1000) };
  assert.deepEqual(lire(ecrire(valeur)), valeur);
  assert.equal(lire(ecrire(100000)), 100000);
  assert.equal(lire(ecrire('abc')), 'abc');
});

test('lire : les formes que ecrire n\'emploie pas mais que leur page peut envoyer', () => {
  assert.equal(lire(Uint8Array.from([0xc0])), null);
  assert.equal(lire(Uint8Array.from([0xc3])), true);
  assert.equal(lire(Uint8Array.from([0xff])), -1);
  assert.equal(lire(Uint8Array.from([0xd0, 0x80])), -128);
  assert.equal(lire(Uint8Array.from([0xd9, 0x02, 0x68, 0x69])), 'hi');
});

test('lire : des octets tronques ou un type inconnu levent', () => {
  assert.throws(() => lire(Uint8Array.from([0xcd, 0x01])), RangeError);
  assert.throws(() => lire(Uint8Array.from([0xc1])), TypeError);
  assert.throws(() => lire(Uint8Array.from([0x01, 0x02])), RangeError, 'des octets en trop cachent une autre valeur');
});

const ETAT = {
  niveau: 200,
  allocation: { vitalite: 0, sagesse: 0, force: 300, intelligence: 0, chance: 0, agilite: 0 },
  scrolls: { vitalite: true, force: true },
  equipped: porter([['amulette:0', 100], ['anneau:0', 200], ['anneau:1', 201], ['artefact:3', 400], ['arme:0', 500]]),
};

test('lireLienDofusbook : retrouve niveau, points, parchemins et pieces du lien que nous fabriquons', () => {
  const lu = lireLienDofusbook(lienDofusbook(ETAT));
  assert.equal(lu.niveau, 200);
  assert.deepEqual(lu.allocation, ETAT.allocation);
  assert.deepEqual(lu.scrolls, { vitalite: true, sagesse: false, force: true, intelligence: false, chance: false, agilite: false });
  assert.deepEqual(lu.pieces, [['amulette:0', 100], ['anneau:0', 200], ['anneau:1', 201], ['artefact:3', 400], ['arme:0', 500]]);
});

test('lireLienDofusbook : accepte le parametre seul, ou une adresse collee avec des espaces', () => {
  const lien = lienDofusbook(ETAT);
  const code = new URL(lien).searchParams.get('stuff');
  assert.equal(lireLienDofusbook(code).niveau, 200);
  assert.equal(lireLienDofusbook(`  ${lien}\n`).niveau, 200);
});

test('lireLienDofusbook : dit clairement ce qui ne va pas', () => {
  assert.throws(() => lireLienDofusbook(''), /vide/i);
  assert.throws(() => lireLienDofusbook('https://www.dofusbook.net/fr/equipement/dofus-3/12345'), /stuff/);
  assert.throws(() => lireLienDofusbook('?stuff=%%%'), /lien/i);
  const sansCles = `${new URL(lienDofusbook(ETAT)).origin}/?stuff=${encodeURIComponent(Buffer.from(ecrire({ 2: 200 })).toString('base64'))}`;
  assert.throws(() => lireLienDofusbook(sansCles), /forme/i);
});

const CATALOGUE = [
  { id: 1, fr: 'Coiffe du Comte Harebourg', slot: 'chapeau', level: 200 },
  { id: 2, fr: 'Anneau Gelano', slot: 'anneau', level: 60 },
  { id: 3, fr: 'Gelano', slot: 'anneau', level: 60 },
  { id: 4, fr: 'Dofus Émeraude', slot: 'artefact', level: 6 },
];

test('reconnaitreNoms : retrouve les noms sans tenir compte de la casse, des accents ni du niveau', () => {
  const texte = 'Coiffe du comte harebourg\nDofus Emeraude (Niv. 6)\n\nGELANO  ';
  const lu = reconnaitreNoms(texte, CATALOGUE);
  assert.deepEqual(lu.trouves.map((t) => t.item.id), [1, 4, 3]);
  assert.deepEqual(lu.inconnues, []);
});

test('reconnaitreNoms : garde les lignes inconnues et saute les lignes sans nom', () => {
  const lu = reconnaitreNoms('Anneau de rien du tout\n200\n- \nGelano', CATALOGUE);
  assert.deepEqual(lu.trouves.map((t) => t.item.id), [3]);
  assert.deepEqual(lu.inconnues, ['Anneau de rien du tout']);
});

test('reconnaitreNoms : un meme nom deux fois donne deux pieces, pour les anneaux', () => {
  const lu = reconnaitreNoms('Gelano\nGelano\nGelano', CATALOGUE);
  assert.equal(lu.trouves.length, 3);
});

test('reconnaitreNoms : un texte vide ne trouve rien', () => {
  assert.deepEqual(reconnaitreNoms('', CATALOGUE), { trouves: [], inconnues: [] });
});
