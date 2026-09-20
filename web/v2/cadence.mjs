/**
 * A quel rythme l'ecran se repeint, et surtout : a quel moment il ne se
 * repeint PAS.
 *
 * Pendant une recherche, chaque fil rend une vague par seconde et le meilleur
 * build s'applique des qu'il s'ameliore. Chaque application repeint l'ecran,
 * et repeindre veut dire remplacer des noeuds. Un clic se joue en deux temps —
 * le doigt descend sur un bouton, il remonte dessus — et le navigateur ne
 * compte le clic que si le MEME noeud recoit les deux. Un repeint glisse entre
 * les deux temps, et le clic n'arrive jamais. C'est le defaut qu'on voit en
 * ligne : « parfois mes clics ne passent pas ».
 *
 * Quatre regles suffisent a le faire disparaitre :
 *
 *   1. plusieurs demandes rapprochees ne font qu'un seul repeint ;
 *   2. tant qu'un doigt est pose, rien ne se repeint ;
 *   3. le doigt leve ne repeint pas non plus : le navigateur envoie « clic »
 *      APRES « doigt leve », et repeindre entre les deux remplace le bouton
 *      avant son clic. Le repeint retenu attend donc l'image suivante ;
 *   4. un rythme peut s'imposer : pendant une recherche, chaque vague
 *      demandait un repeint complet, et chaque repeint complet coute des
 *      dizaines de millisecondes de calcul. Le fil principal n'avait plus de
 *      quoi faire defiler la page ni recevoir un clic.
 *
 * Rien ici ne connait le document : le planificateur et le peintre sont
 * donnes. C'est ce qui permet de verifier la regle sans navigateur.
 */

/**
 * Cree la cadence de repeint.
 *
 * @param {object} liens
 * @param {() => void} liens.peindre Repeint l'ecran, pour de vrai.
 * @param {(suite: () => void, delai: number) => void} liens.planifier Reporte
 *   au prochain moment ou peindre a du sens — une image d'ecran, en general.
 *   `delai` vaut zero, sauf quand un rythme impose de patienter.
 * @param {() => number} [liens.horloge] Le temps qui passe, en millisecondes.
 * @returns {{demander: () => void, enfoncer: () => void, relacher: () => void,
 *   rythme: (ms: number) => void}}
 */
export function creerCadence({ peindre, planifier, horloge = () => Date.now() }) {
  /** Un repeint est deja programme : une demande de plus ne coute rien. */
  let programme = false;

  /** Un doigt est pose : tout repeint attend qu'il se leve. */
  let enfonce = false;

  /** Un repeint a ete demande pendant que le doigt etait pose. */
  let du = false;

  /** Ecart minimal entre deux repeints. Zero : aucun. */
  let minimum = 0;

  /** Quand le dernier repeint a eu lieu. */
  let dernier = Number.NEGATIVE_INFINITY;

  /** Programme un repeint, si aucun ne l'est deja. */
  function programmer(delai = 0) {
    if (programme) return;
    programme = true;
    planifier(maintenant, delai);
  }

  /** Repeint, ou reporte : sous un doigt, ou trop tot pour le rythme. */
  function maintenant() {
    programme = false;
    if (enfonce) { du = true; return; }

    const reste = minimum - (horloge() - dernier);
    if (reste > 0) { programmer(reste); return; }

    du = false;
    dernier = horloge();
    peindre();
  }

  return {
    /** Demande un repeint. Plusieurs demandes rapprochees n'en font qu'un. */
    demander() { programmer(); },

    /** Un doigt vient de se poser : plus rien ne bouge sous lui. */
    enfoncer() { enfonce = true; },

    /**
     * Le doigt se leve. Le repeint retenu NE part PAS ici : le clic n'est pas
     * encore envoye, et remplacer le bouton maintenant l'avalerait.
     */
    relacher() {
      enfonce = false;
      if (du) programmer();
    },

    /**
     * Impose un ecart minimal entre deux repeints, en millisecondes.
     * Zero rend la cadence a l'image d'ecran.
     */
    rythme(ms) { minimum = Math.max(0, Number(ms) || 0); },
  };
}
