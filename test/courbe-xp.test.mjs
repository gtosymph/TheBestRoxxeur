/**
 * La courbe « sagesse contre degats » du mode Monter.
 *
 * Le score est un produit : degats x (1 + sagesse / 100). Le joueur, lui,
 * hesite au meme endroit que sur la courbe de survie — « si je monte a 400 de
 * sagesse, je perds combien de degats ? ». La courbe repond sans relancer la
 * recherche, et le point qui gagne le produit s'y marque.
 *
 * Il n'y a aucun curseur ici, et c'est voulu : le produit ne se regle pas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { consequenceXp, palierXpRetenu, signatureXp } from '../web/v2/courbe-xp.mjs';
import { AXE_XP, axeDe, frontiereSurvie } from '../src/solver/survie.mjs';

const ligne = (damage, sagesse) => ({ palier: { damage, sagesse } });

test('le palier que le produit retient', async (t) => {
  await t.test('c est celui dont la vitesse d XP est la plus haute', () => {
    const lignes = [
      ligne(1000, 0), // 1 000
      ligne(800, 100), // 1 600
      ligne(400, 300), // 1 600
      ligne(700, 200), // 2 100
    ];
    assert.equal(palierXpRetenu(lignes), 3);
  });

  await t.test('sans degats, aucune sagesse ne gagne', () => {
    assert.equal(palierXpRetenu([ligne(0, 900), ligne(10, 0)]), 1);
  });

  await t.test('une courbe vide ne retient rien', () => {
    assert.equal(palierXpRetenu([]), null);
    assert.equal(palierXpRetenu(null), null);
  });

  await t.test('a egalite, le premier rencontre garde la main', () => {
    assert.equal(palierXpRetenu([ligne(800, 100), ligne(400, 300)]), 0);
  });
});

test('ce qu un point annonce', async (t) => {
  const lignes = [ligne(900, 250)];

  await t.test('les degats, la sagesse, le multiplicateur et la vitesse', () => {
    assert.deepEqual(consequenceXp(lignes, 0), {
      degats: 900, sagesse: 250, multiplicateur: 3.5, vitesse: 900 * 3.5,
    });
  });

  await t.test('le multiplicateur est ce qui se lit, la vitesse ce qui classe', () => {
    // Deux stuffs a la meme vitesse d'XP n'ont pas le meme multiplicateur :
    // c'est bien deux mesures differentes, et non deux noms de la meme.
    const a = consequenceXp([ligne(1000, 100)], 0);
    const b = consequenceXp([ligne(500, 300)], 0);
    assert.equal(a.vitesse, b.vitesse);
    assert.notEqual(a.multiplicateur, b.multiplicateur);
  });

  await t.test('un rang qui ne designe rien n annonce rien', () => {
    assert.equal(consequenceXp(lignes, 7), null);
    assert.equal(consequenceXp(lignes, null), null);
  });
});

test('la signature de la courbe', async (t) => {
  await t.test('deux courbes aux memes paliers ont la meme signature', () => {
    assert.equal(signatureXp([ligne(900, 250)]), signatureXp([ligne(900, 250)]));
  });

  await t.test('un palier different change la signature', () => {
    assert.notEqual(signatureXp([ligne(900, 250)]), signatureXp([ligne(900, 300)]));
  });

  await t.test('une courbe absente a une signature vide', () => {
    assert.equal(signatureXp(null), '');
  });
});

test('le sens de l axe', async (t) => {
  await t.test('le mode Monter tranche les degats et maximise la sagesse', () => {
    // Le sens a ete mesure : baisser la sagesse ne rend aucun degat, parce
    // que les pieces qui donnent l'une donnent souvent l'autre. Le change
    // n'existe qu'au dela du gagnant, quand la sagesse commence a se payer.
    assert.equal(axeDe('xp'), AXE_XP);
    assert.equal(AXE_XP.cle, 'damage');
    assert.equal(AXE_XP.valeur, 'sagesse');
  });

  await t.test('la frontiere ne garde que ce qui vaut l echange', () => {
    const paliers = [
      { damage: 5000, sagesse: 700 },
      { damage: 4000, sagesse: 650 }, // moins de degats ET moins de sagesse
      { damage: 3000, sagesse: 900 },
    ];
    assert.deepEqual(frontiereSurvie(paliers, AXE_XP), [
      { damage: 5000, sagesse: 700 },
      { damage: 3000, sagesse: 900 },
    ]);
  });
});

test('le bonus d XP hors sagesse sur la courbe', async (t) => {
  await t.test('il peut changer le point retenu', () => {
    const lignes = [ligne(5000, 800), ligne(2500, 1700)];
    assert.equal(palierXpRetenu(lignes), 0, 'a egalite, le premier garde la main');
    assert.equal(palierXpRetenu([ligne(2500, 1700), ligne(5000, 800)]), 0);
    assert.equal(palierXpRetenu([ligne(2500, 1700), ligne(5000, 800)], 200), 1,
      'avec le bonus, le stuff qui frappe gagne');
  });

  await t.test('le multiplicateur annonce compte le bonus', () => {
    const quoi = consequenceXp([ligne(900, 250)], 0, 150);
    assert.equal(quoi.multiplicateur, 5);
    assert.equal(quoi.vitesse, 4500);
  });
});
