import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ecrirePng, lirePng } from '../scripts/lib/png.mjs';

/** Un degrade avec du bruit et un bord transparent. */
function imageDegrade(largeur, hauteur) {
  const pixels = Buffer.alloc(largeur * hauteur * 4);
  let graine = 7;
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      graine = (graine * 1103515245 + 12345) & 0x7fffffff;
      const i = (y * largeur + x) * 4;
      pixels[i] = (x * 3 + y) & 0xff;
      pixels[i + 1] = (y * 2) & 0xff;
      pixels[i + 2] = (x + y * 5 + (graine & 3)) & 0xff;
      pixels[i + 3] = x < 4 ? 0 : 255;
    }
  }
  return { largeur, hauteur, pixels };
}

test('ecrirePng rend une image que lirePng relit a l\'identique', () => {
  const image = imageDegrade(40, 30);
  const relue = lirePng(ecrirePng(image));
  assert.equal(relue.largeur, 40);
  assert.equal(relue.hauteur, 30);
  assert.ok(relue.pixels.equals(image.pixels));
});

test('une vraie icone du catalogue se reecrit sans perdre un pixel', () => {
  const fichier = readFileSync(new URL('../web/assets/items/10003.png', import.meta.url));
  const image = lirePng(fichier);
  assert.ok(lirePng(ecrirePng(image)).pixels.equals(image.pixels));
});
