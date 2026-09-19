/**
 * Recupere le bestiaire DofusDB : nom, race, grades et resistances.
 * Ecrit data/monsters.json, compact, pour la liste « Cible » de l'ecran.
 *
 * Le fichier pese ce qu'il pese — cinq mille monstres, cinq grades chacun —
 * et l'ecran ne le charge que quand le joueur ouvre la liste. D'ou le format
 * serre : une ligne, et chaque grade en tableau plat —
 * [grade, niveau, pdv, neutre, terre, feu, eau, air] — rien qui ne serve
 * pas a choisir une cible. src/data/bestiaire.mjs relit ce format.
 */
import { writeFile } from 'node:fs/promises';
import { fetchAll } from './lib/dofusdb.mjs';

const frName = (node) => (node?.name?.fr ?? node?.name?.en ?? '').trim();
const entier = (n) => (Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : 0);

/** Un grade, tel que le bestiaire le garde : un tableau plat. */
function grade(brut) {
  return [
    entier(brut.grade), entier(brut.level), entier(brut.lifePoints),
    entier(brut.neutralResistance), entier(brut.earthResistance), entier(brut.fireResistance),
    entier(brut.waterResistance), entier(brut.airResistance),
  ];
}

/**
 * Un monstre, tel que le bestiaire le garde.
 *
 * `boss` vaut 2 pour un boss, 1 pour un mini-boss, 0 sinon : la liste s'en
 * sert pour filtrer et pour marquer. Un monstre sans grade lisible ne sert a
 * rien dans une liste de cibles, il ne part pas.
 *
 * @param {any} brut
 * @param {Map<number, string>} races
 */
export function compacterMonstre(brut, races) {
  const grades = (Array.isArray(brut.grades) ? brut.grades : [])
    .filter((g) => Number.isFinite(Number(g?.grade)))
    .map(grade)
    .sort((a, b) => a[0] - b[0]);
  if (grades.length === 0 || !frName(brut)) return null;

  return {
    id: brut.id,
    nom: frName(brut),
    race: races.get(brut.race) ?? '',
    boss: brut.isBoss ? 2 : (brut.isMiniBoss ? 1 : 0),
    ...(brut.isQuestMonster ? { quete: true } : {}),
    grades,
  };
}

async function main() {
  process.stdout.write('Recuperation du bestiaire...\n');
  const racesBrutes = await fetchAll('monster-races', {});
  const races = new Map(racesBrutes.map((r) => [r.id, frName(r)]));

  const bruts = await fetchAll('monsters', {}, (loaded, total) => {
    process.stdout.write(`\r  monstres ${loaded}/${total}`);
  });
  process.stdout.write('\n');

  const monstres = bruts
    .filter((row) => Number.isInteger(row.id))
    .map((row) => compacterMonstre(row, races))
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);

  await writeFile('data/monsters.json', `${JSON.stringify(monstres)}\n`, 'utf8');
  process.stdout.write(`Ecrit data/monsters.json (${monstres.length} monstres).\n`);
}

if (process.argv[1]?.endsWith('fetch-monsters.mjs')) {
  main().catch((error) => {
    process.stderr.write(`Echec: ${error.message}\n`);
    process.exitCode = 1;
  });
}
