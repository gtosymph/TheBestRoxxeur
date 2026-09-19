/**
 * Resume, en Markdown, ce qu'une ingestion a change dans data/.
 *
 *   node scripts/diff-catalogue.mjs <dossier-avant> [dossier-apres]
 *
 * Le second dossier vaut `data/` par defaut. Le workflow de rafraichissement
 * copie `data/` avant d'ingerer, puis appelle ce script pour le corps de sa PR.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { comparer, resumeMarkdown } from '../src/data/difference-catalogue.mjs';

const FICHIERS = [
  ['items.json', 'objets'],
  ['sets.json', 'panoplies'],
  ['effects.json', 'effets'],
];

async function lire(dossier, fichier) {
  return JSON.parse(await readFile(join(dossier, fichier), 'utf8'));
}

async function main() {
  const [avant, apres = 'data'] = process.argv.slice(2);
  if (!avant) {
    process.stderr.write('Usage : node scripts/diff-catalogue.mjs <dossier-avant> [dossier-apres]\n');
    process.exit(2);
  }
  const parFichier = {};
  for (const [fichier, nom] of FICHIERS) {
    parFichier[nom] = comparer(await lire(avant, fichier), await lire(apres, fichier));
  }
  process.stdout.write(`${resumeMarkdown(parFichier)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
