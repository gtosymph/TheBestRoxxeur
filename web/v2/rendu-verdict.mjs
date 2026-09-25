/**
 * Le haut du volet de gauche : le verdict, l'objectif et le score.
 *
 * Ce sont les chiffres que le joueur vient lire en premier — les degats, les
 * points de vie effectifs, les achats — et le choix de ce que la recherche
 * fait monter. Les deux courbes, du mode mixte et du mode Monter, vivent ici
 * aussi : elles ne paraissent que dans l'objectif qui s'en sert.
 */
import { el, renderOptions } from '../render.mjs';
import { optionsAffichees } from '../reglages.mjs';
import { objectif, sortsCalcules } from '../objectif.mjs';
import { multiplicateurXp, normaliserBonusXp, SEARCH_MODES } from '../../src/solver/score.mjs';
import { borneDegats } from '../../src/solver/borne.mjs';

import { rangerOptions } from './options.mjs';
import { ouvrirCible, renderBlocCible } from './vue-cible.mjs';
import { resumeCible } from './cible.mjs';
import { renderCourbeXp } from './vue-courbe-xp.mjs';
import { renderMelange } from './vue-melange.mjs';
import { facteur, nombre } from './nombres.mjs';

/**
 * Les objectifs proposes.
 *
 * « Caracteristiques » n'y figure pas : ce n'est plus un choix dans une liste,
 * c'est l'etat dans lequel l'outil se met quand il n'a aucun degat a compter.
 * Le joueur ne le choisit jamais, il le constate.
 */
const OBJECTIFS = Object.freeze([
  [SEARCH_MODES.DAMAGE, 'Frapper fort'],
  [SEARCH_MODES.ENDURANCE, 'Encaisser'],
  [SEARCH_MODES.MIXTE, 'Les deux'],
  [SEARCH_MODES.XP, 'Monter'],
]);

/**
 * @param {object} liens
 * @param {(id: string) => HTMLElement} liens.$
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 * @param {() => any} liens.lireCatalogue
 * @param {any} liens.recherche
 * @param {(cle: string, valeur: any) => void} liens.poserOption
 */
export function creerRenduVerdict({
  $, lireEtat, setEtat, message, lireCatalogue, recherche, poserOption,
}) {
  /** Vrai quand aucun sort n'est pose : tout ce qui parle de degats se tait. */
  const sansSorts = () => sortsCalcules(lireEtat()).length === 0;

  /**
   * La borne haute se recalcule seulement quand ce qui la fait bouger a bouge :
   * elle parcourt tout le catalogue, et un rendu par frappe au clavier ne doit
   * pas le payer.
   */
  let borneGardee = { cle: null, valeur: null };

  function borneCourante() {
    const etat = lireEtat();
    const catalogue = lireCatalogue();
    const objective = objectif(etat, catalogue);
    const cle = JSON.stringify([etat.niveau, [...etat.bannis], etat.scrolls, etat.options.passifs,
      objective.spells, objective.cible, objective.menace]);
    if (borneGardee.cle !== cle) {
      borneGardee = {
        cle,
        valeur: borneDegats({
          items: catalogue.items, level: etat.niveau, setById: catalogue.setById,
          banned: etat.bannis, scrolls: etat.scrolls, objective,
        }),
      };
    }
    return borneGardee.valeur;
  }

  /** Sous les degats : ce qu'aucun stuff ne depasse, et pourquoi c'est au-dessus. */
  function renderBorne() {
    const borne = borneCourante();
    const noeud = $('borne-phrase');
    noeud.hidden = borne === null;
    if (borne === null) return;
    noeud.textContent = `Borne haute : ${nombre(borne)}, qu'aucun stuff n'atteint.`;
    noeud.title = 'Chaque emplacement prend le meilleur de chaque statistique, sans les conditions '
      + 'ni le cumul des panoplies, et tous les points vont partout à la fois. '
      + 'Le vrai optimum est en dessous, souvent de loin.';
  }

  function renderVerdict(stats, degats) {
    const etat = lireEtat();
    const vDegats = $('v-degats');
    vDegats.textContent = degats === null ? '—' : nombre(degats);
    vDegats.classList.toggle('vide-mesure', degats === null);
    $('degats-sans-sorts').hidden = degats !== null;
    $('degats-avec-sorts').hidden = degats === null;
    if (degats !== null) {
      // En mode « Monter », la phrase dit le MULTIPLICATEUR et rien d'autre.
      // La vitesse d'XP est un produit sans unite : elle classe les stuffs,
      // elle ne se lit pas. « x 9,19 » se compare a ce que le joueur connait.
      const enXp = etat.mode === SEARCH_MODES.XP;
      const sagesse = Number(stats.sagesse) || 0;
      const bonus = normaliserBonusXp(etat.bonusXp);
      const quiMultiplie = bonus > 0
        ? `Votre sagesse de ${nombre(sagesse)} et vos ${nombre(bonus)} % de bonus multiplient`
        : `Votre sagesse de ${nombre(sagesse)} multiplie`;
      $('degats-phrase').textContent = `Vos sorts envoient ${nombre(degats)} dégâts sur un tour.`
        + (enXp
          ? ` ${quiMultiplie} l'XP de chaque combat `
            + `par ${facteur(multiplicateurXp(sagesse, bonus))}.`
          : '');
      renderBorne();
    }

    const pdv = Number(stats.pdvEffectifs) || 0;
    $('v-pdv').textContent = nombre(pdv);
    $('pdv-phrase').textContent = `Vous encaissez ${nombre(pdv)} dégâts bruts avant de tomber.`;

    const rangees = rangerOptions(optionsAffichees(etat.options));
    renderOptions($('options-degats'), rangees.degats, poserOption);
    renderOptions($('options-pdv'), rangees.pdv, poserOption);
    // Contre quoi le nombre est compte : sans la phrase, 947 ne dit rien.
    renderBlocCible($('bloc-cible'), resumeCible(etat.cible),
      () => ouvrirCible({ lireEtat, setEtat, message }));

    // « A acheter » n'a de sens que face a un stuff de reference : sans lui, tout
    // est un achat, et le chiffre ne dit rien.
    const aAcheter = etat.reference
      ? [...etat.equipped.values()].filter((item) => !etat.reference.itemIds.includes(item.id)
          && !etat.possedees.has(item.id)).length
      : null;
    $('v-achats').textContent = aAcheter === null ? '—' : nombre(aAcheter);
    $('achats-phrase').textContent = aAcheter === null
      ? 'Dites-moi quel stuff vous portez pour compter les achats.'
      : 'face à votre stuff actuel';
  }

  function renderObjectif() {
    const etat = lireEtat();
    const muet = sansSorts();
    $('objectif').classList.toggle('inactif', muet);
    $('objectif').classList.toggle('sans-choix', etat.mode === SEARCH_MODES.STATS);
    // La largeur vient de la feuille de style : un « flex » ecrit ici l'emportait
    // sur elle, et le quatrieme objectif sortait du volet au lieu de passer a la
    // ligne.
    $('objectif').replaceChildren(...OBJECTIFS.map(([cle, texte]) => el('button', {
      type: 'button', 'data-mode': cle,
      'aria-pressed': String(etat.mode === cle),
      ...(muet ? { disabled: true } : {}),
      onClick: () => setEtat({ mode: cle }),
    }, texte)));

    $('aide-objectif').textContent = muet
      ? 'Sans sort, la recherche monte vos caractéristiques. Choisissez des sorts '
        + 'pour arbitrer entre frapper et encaisser.'
      : etat.mode === SEARCH_MODES.XP
        ? 'La recherche monte la vitesse d\'XP : vos dégâts décident du nombre de '
          + 'combats, votre sagesse multiplie l\'XP de chacun.'
        : 'La recherche fait monter cette mesure et tient les minimums demandes.';
    renderBonusXp();
  }

  /**
   * Le champ du bonus d'XP hors sagesse, en mode Monter seulement.
   *
   * La valeur ne se repose pas pendant que le joueur ecrit : un redessin au
   * milieu de la frappe remplacerait « 15 » par « 1 » avant le second chiffre.
   */
  function renderBonusXp() {
    const etat = lireEtat();
    const enXp = !sansSorts() && etat.mode === SEARCH_MODES.XP;
    $('bonus-xp').hidden = !enXp;
    const champ = $('bonus-xp-valeur');
    if (document.activeElement !== champ) champ.value = String(normaliserBonusXp(etat.bonusXp));
  }

  /**
   * La courbe du mode Monter ne parait que dans ce mode.
   *
   * Elle repond a ce que le produit cache : ou passe le change entre les
   * degats et la sagesse. Ailleurs, elle trancherait sur une mesure que la
   * recherche n'optimise pas, et le trace ne voudrait rien dire.
   */
  function renderCourbeXpOuPas(bilan, stats) {
    const etat = lireEtat();
    const enXp = etat.mode === SEARCH_MODES.XP;
    $('courbe-xp').hidden = !enXp;
    if (!enXp) return;

    renderCourbeXp($('courbe-xp'), {
      paliers: etat.survie ?? [],
      porte: bilan
        ? { damage: bilan.damage, sagesse: Number(stats?.sagesse) || 0 }
        : null,
      bonus: normaliserBonusXp(etat.bonusXp),
      onChoisir: (palier) => {
        recherche.porterAlaMain(palier);
        message(`Stuff porté : ${nombre(Math.floor(palier.damage))} de dégâts, `
          + `${nombre(Math.floor(palier.sagesse ?? 0))} de sagesse.`);
      },
    });
  }

  /**
   * Le reglage du melange n'existe que dans le mode qui s'en sert.
   *
   * Un curseur visible dans « frapper fort » laisserait croire qu'il change
   * quelque chose ; il ne changerait rien, et le joueur chercherait longtemps
   * pourquoi.
   */
  function renderMelangeOuPas(bilan, stats) {
    const etat = lireEtat();
    const enMixte = etat.mode === SEARCH_MODES.MIXTE;
    $('melange').hidden = !enMixte;
    if (!enMixte) return;

    renderMelange($('melange'), {
      paliers: etat.survie ?? [],
      // `pdv` ne vient pas du score : il vit dans les statistiques du build.
      porte: bilan
        ? { damage: bilan.damage, endurance: bilan.endurance, pdv: Number(stats.pdv) || 0 }
        : null,
      part: etat.partDegats,
      onPart: (part) => setEtat({ partDegats: part }),
      onChoisir: (palier, part) => {
        recherche.porterAlaMain(palier, { partDegats: part });
        message(`Stuff porté : ${nombre(Math.floor(palier.damage))} de dégâts, `
          + `${nombre(Math.floor(palier.endurance))} pdv effectifs.`);
      },
    });
  }

  function renderScore(bilan) {
    if (!bilan) return;
    const etat = lireEtat();
    const valeur = Number(bilan.score);
    $('score').textContent = Number.isFinite(valeur) ? nombre(valeur) : '—';

    // Un score negatif ne se lit pas comme un petit score : il dit qu'un
    // minimum n'est pas tenu. La couleur et la note le disent ensemble.
    const tenus = bilan?.satisfied !== false;
    $('score').classList.toggle('pos', tenus);
    $('score').classList.toggle('neg', !tenus);
    // En mode « Monter », le score est un produit sans unite. Seul, il ne dit
    // rien au joueur : la note lui donne la mesure qui se lit.
    const sagesse = Number(bilan.sagesse);
    const enXp = etat.mode === SEARCH_MODES.XP && Number.isFinite(sagesse);
    $('score-note').textContent = tenus
      ? (enXp ? `score · XP ×${facteur(multiplicateurXp(sagesse, etat.bonusXp))}` : 'score')
      : `${bilan.unmet.length} minimum(s) non tenu(s)`;
    recherche.dessiner();
  }

  return {
    sansSorts, renderVerdict, renderObjectif, renderCourbeXpOuPas, renderMelangeOuPas, renderScore,
  };
}
