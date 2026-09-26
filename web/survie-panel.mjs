/**
 * Les lignes du compromis « degats ou survie ».
 *
 * Le panneau de v1 qui les dessinait n'existe plus : v2 les montre dans le
 * curseur mixte (web/v2/vue-melange.mjs). Ce fichier garde le calcul.
 *
 * Le solveur rend le build le plus fort sous les conditions, dont celle de
 * vitalite. Le joueur hesite pourtant toujours au meme endroit : « et si je
 * lachais 500 points de vie ? ». Le panneau repond sans relancer quoi que ce
 * soit : pendant la recherche, le solveur a garde le build le plus fort de
 * chaque tranche d'endurance.
 *
 * L'axe est l'endurance, c'est-a-dire les points de vie une fois les
 * resistances comptees (src/engine/defense.mjs). Une piece qui rend vingt
 * pour cent de resistance vaut donc un quart de vie en plus, et le panneau
 * montre les deux nombres : ce que le jeu affiche, et ce que le personnage
 * encaisse vraiment.
 *
 * La courbe se lit de haut en bas : plus d'endurance en haut, plus de degats
 * en bas. Le build porte y prend place : chaque ligne dit ce qu'elle lui
 * coute en survie et ce qu'elle lui rapporte en degats.
 */
import { AXE_ENDURANCE, frontiereSurvie } from '../src/solver/survie.mjs';
import { scoreMixte } from '../src/solver/score.mjs';

/**
 * Lignes a montrer, de la plus grande endurance a la plus petite, build porte
 * compris.
 *
 * Le build porte entre dans la frontiere comme un palier : une ligne qui tient
 * moins longtemps ET frappe moins fort que lui n'a rien a dire, elle tombe. Ce
 * qui reste vaut l'echange dans un sens ou dans l'autre.
 *
 * @param {any[]} paliers Paliers rendus par le solveur.
 * @param {{endurance: number, pdv: number, damage: number}|null} porte Build pose.
 * @returns {{palier: any, porte: boolean, gainDegats: number|null,
 *            ecartEndurance: number|null, ecartPdv: number|null}[]}
 */
export function lignesSurvie(paliers, porte, axe = AXE_ENDURANCE) {
  const mesurable = porte
    && Number.isFinite(porte[axe.cle]) && Number.isFinite(porte[axe.valeur]);
  // Un palier qui ne fait pas mieux que le build porte sur les deux mesures
  // n'a rien a dire — le build porte lui-meme compris, qui se retrouve dans
  // la courbe quand il vient du solveur.
  const utiles = mesurable
    ? paliers.filter((p) => p[axe.valeur] > porte[axe.valeur] || p[axe.cle] > porte[axe.cle])
    : paliers;
  const entrees = mesurable ? [...utiles, { ...porte, porte: true }] : [...utiles];

  return frontiereSurvie(entrees, axe).map((palier) => ({
    palier,
    porte: palier.porte === true,
    // `gain` porte ce que la courbe maximise, `ecart` ce qu'elle tranche.
    gain: mesurable && !palier.porte ? palier[axe.valeur] - porte[axe.valeur] : null,
    ecart: mesurable && !palier.porte ? palier[axe.cle] - porte[axe.cle] : null,
    ecartPdv: mesurable && !palier.porte && Number.isFinite(palier.pdv)
      && Number.isFinite(porte.pdv) ? palier.pdv - porte.pdv : null,
  }));
}

/**
 * Rang de la ligne que le mode mixte retient.
 *
 * La courbe montre deja tous les compromis tenables : le curseur de la part
 * des degats ne fait que choisir un point dessus. Le marquer repond d'un coup
 * d'oeil a « ou m'a mene mon reglage ? », et bouger le curseur montre le
 * marqueur glisser le long de la courbe.
 *
 * @param {{palier: {damage: number, endurance: number}}[]} lignes
 * @param {number|null} [part] Part des degats, ou null hors mode mixte.
 * @returns {number|null} Rang de la ligne retenue, ou null.
 */
export function palierRetenu(lignes, part) {
  if (part === null || part === undefined || lignes.length === 0) return null;

  let meilleur = null;
  let rang = null;
  for (let i = 0; i < lignes.length; i += 1) {
    const { damage = 0, endurance = 0 } = lignes[i].palier ?? {};
    const note = scoreMixte(damage, endurance, part);
    if (meilleur === null || note > meilleur) {
      meilleur = note;
      rang = i;
    }
  }
  return rang;
}
