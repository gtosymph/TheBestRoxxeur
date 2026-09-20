/**
 * Ce que l'objectif paie, ligne par ligne.
 *
 * Sans cette mesure, la forgemagie automatique n'aurait aucun moyen de
 * choisir : elle pousserait la premiere ligne venue. La mesure se prend sur le
 * SCORE, pas sur les seuls degats — une recherche de survie paie la vitalite,
 * une recherche de degats ne la paie pas, et les deux doivent se lire avec la
 * meme fonction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { BUDGET_POIDS } from '../src/engine/runes.mjs';
import { STATS_FORGEABLES, valeursForge } from '../src/solver/forge-valeurs.mjs';
import { SEARCH_MODES } from '../src/solver/score.mjs';

/** Un sort de feu : seule l'intelligence le fait monter. */
const SORT_FEU = {
  name: 'Flamiche',
  lines: [{ element: 'feu', min: 20, max: 30, critMin: 25, critMax: 35, range: 'distance', source: 'sort' }],
};

const BASE = { intelligence: 300, chance: 300, vitalite: 1000 };

test('les statistiques forgeables', async (t) => {
  await t.test('les trois exos rares n en font pas partie', () => {
    // Un PA ne s'over pas : il s'exo, et le moteur a deja un chemin pour ca.
    for (const rare of ['pa', 'pm', 'po']) {
      assert.equal(STATS_FORGEABLES.includes(rare), false, `${rare} ne doit pas etre forgeable en over`);
    }
  });

  await t.test('les caracteristiques primaires en font partie', () => {
    for (const stat of ['force', 'intelligence', 'vitalite']) {
      assert.equal(STATS_FORGEABLES.includes(stat), true);
    }
  });
});

test('la valeur d un point, par caracteristique', async (t) => {
  const objectifDegats = {
    conditions: [], spells: [SORT_FEU], mode: SEARCH_MODES.DAMAGE, cible: null,
  };

  await t.test('un sort de feu paie l intelligence, pas la chance', () => {
    const valeurs = valeursForge({
      raw: BASE, level: 190, objective: objectifDegats, budget: BUDGET_POIDS,
    });
    assert.ok(valeurs.intelligence > 0, 'l intelligence doit valoir quelque chose');
    assert.equal(valeurs.chance, undefined, 'la chance ne rapporte rien a un sort de feu');
  });

  await t.test('la vitalite ne paie pas une recherche de degats', () => {
    const valeurs = valeursForge({
      raw: BASE, level: 190, objective: objectifDegats, budget: BUDGET_POIDS,
    });
    assert.equal(valeurs.vitalite, undefined);
  });

  await t.test('une recherche de survie paie la vitalite', () => {
    const valeurs = valeursForge({
      raw: BASE, level: 190, budget: BUDGET_POIDS,
      objective: { conditions: [], spells: [SORT_FEU], mode: SEARCH_MODES.ENDURANCE, cible: null },
    });
    assert.ok(valeurs.vitalite > 0, 'la vitalite doit valoir quelque chose en survie');
  });

  await t.test('un budget nul ne paie rien', () => {
    assert.deepEqual(valeursForge({
      raw: BASE, level: 190, objective: objectifDegats, budget: 0,
    }), {});
  });

  await t.test('la valeur est rendue PAR POINT, pas pour le budget entier', () => {
    const valeurs = valeursForge({
      raw: BASE, level: 190, objective: objectifDegats, budget: BUDGET_POIDS,
    });
    const moitie = valeursForge({
      raw: BASE, level: 190, objective: objectifDegats, budget: BUDGET_POIDS / 2,
    });
    // Cent un points d'intelligence ou cinquante : le point vaut a peu pres
    // pareil. Les degats montent presque lineairement avec la caracteristique.
    const ecart = Math.abs(valeurs.intelligence - moitie.intelligence) / valeurs.intelligence;
    assert.ok(ecart < 0.2, `le point doit valoir a peu pres pareil, ecart ${ecart}`);
  });
});
