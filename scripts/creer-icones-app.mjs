/**
 * Dessine les icones de l'application installee : le losange de la marque sur
 * son fond, en 192 et 512 pixels.
 *
 * Un navigateur n'installe une page que si son manifeste porte une icone
 * matricielle assez grande. Le dessin reprend web/favicon.svg ; il se fait ici,
 * pixel par pixel, pour que le projet reste sans dependance.
 *
 *   node scripts/creer-icones-app.mjs
 */
import { writeFileSync } from 'node:fs';
import { ecrirePng } from './lib/png.mjs';

const FOND = [0x16, 0x15, 0x1f];
const LOSANGE = [0x7f, 0x74, 0xff];
/** Sous-echantillons par cote de pixel : les bords du losange restent lisses. */
const FINESSE = 4;

/** Vrai quand le point (x, y), en unites du dessin de 32, tombe dans le losange. */
function dansLosange(x, y) {
  // Le carre de 14 tourne de 45 degres : sa demi-diagonale vaut 7 * racine de 2.
  return Math.abs(x - 16) + Math.abs(y - 16) <= 7 * Math.SQRT2;
}

function dessiner(cote) {
  const pixels = Buffer.alloc(cote * cote * 4);
  const echelle = 32 / cote;
  for (let py = 0; py < cote; py += 1) {
    for (let px = 0; px < cote; px += 1) {
      let dedans = 0;
      for (let sy = 0; sy < FINESSE; sy += 1) {
        for (let sx = 0; sx < FINESSE; sx += 1) {
          const x = (px + (sx + 0.5) / FINESSE) * echelle;
          const y = (py + (sy + 0.5) / FINESSE) * echelle;
          if (dansLosange(x, y)) dedans += 1;
        }
      }
      const part = dedans / (FINESSE * FINESSE);
      const i = (py * cote + px) * 4;
      for (let c = 0; c < 3; c += 1) {
        pixels[i + c] = Math.round(FOND[c] + (LOSANGE[c] - FOND[c]) * part);
      }
      pixels[i + 3] = 255;
    }
  }
  return { largeur: cote, hauteur: cote, pixels };
}

for (const cote of [192, 512]) {
  const chemin = `web/icone-${cote}.png`;
  const png = ecrirePng(dessiner(cote));
  writeFileSync(chemin, png);
  console.log(`${chemin} : ${png.length} octets`);
}
