/**
 * Reecrit un PNG avec la compression la plus forte, sans le changer.
 *
 * Le navigateur enregistre ses canvas a la va-vite : la carte d'apercu en
 * sortait a 500 Ko. Le meme dessin, repasse par notre encodeur, en fait 190.
 * Une image qui se telecharge a chaque lien partage merite ce passage.
 *
 *   node scripts/compacter-png.mjs web/apercu.png
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ecrirePng, lirePng } from './lib/png.mjs';

const chemin = process.argv[2];
if (!chemin) {
  console.error('Usage : node scripts/compacter-png.mjs <fichier.png>');
  process.exit(1);
}

const avant = readFileSync(chemin);
const apres = ecrirePng(lirePng(avant));
writeFileSync(chemin, apres);
console.log(`${chemin} : ${avant.length} -> ${apres.length} octets`);
