/**
 * Les listes du volet de droite : les stuffs trouves, « Proche de mon stuff »,
 * les panoplies actives et l'analyse du stuff porte.
 */
import { renderCandidats, renderPanoplies } from '../render.mjs';
import {
  cibleAffichee, passifsActifs, profilDe, valeurDeReference,
} from '../objectif.mjs';
import { ouvrirFiche } from '../item-panel.mjs';
import { STAT_LABELS } from '../../src/data/stats.mjs';
import { paliersUtiles, renderPaliers, renderReglageProximite } from '../proximite-panel.mjs';
import { renderAnalyse } from '../analyse-panel.mjs';
import { remplacer } from '../equipement.mjs';

import { nombre } from './nombres.mjs';

/**
 * @param {object} liens
 * @param {(id: string) => HTMLElement} liens.$
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 * @param {() => any} liens.lireCatalogue
 * @param {any} liens.recherche
 * @param {any} liens.gestesReference
 * @param {(famille: string, nommer: (objet: any) => string) => any} liens.selectionDe
 * @param {(item: any) => void} liens.poserPiece
 */
export function creerRenduListes({
  $, lireEtat, setEtat, message, lireCatalogue, recherche, gestesReference, selectionDe,
  poserPiece,
}) {
  /**
   * Les autres builds que la recherche a retenus.
   *
   * Chaque ligne se lit comme une DIFFERENCE, pas comme une fiche de plus : les
   * pieces a mettre, celles a enlever, et ce que l'echange rapporte.
   */
  function renderTrouves(bilan) {
    const etat = lireEtat();
    const candidats = etat.candidats ?? [];
    $('compte-trouves').textContent = String(candidats.length);

    renderCandidats($('trouves'), candidats, {
      portes: new Set([...etat.equipped.values()].map((i) => i.id)),
      itemById: lireCatalogue()?.itemById ?? new Map(),
      porte: bilan,
      onPorter: (candidat) => recherche.porterAlaMain(candidat),
      selection: selectionDe('trouve', (candidat) => `Trouvé ${candidats.indexOf(candidat) + 1}`),
    });
  }

  /**
   * « Proche de mon stuff » : ce qu'une a trois pieces achetees rapportent.
   *
   * Le meilleur build du solveur demande souvent seize pieces neuves. Un joueur
   * qui equipe deja un personnage ne veut pas tout racheter. Le gain se lit face
   * au stuff de REFERENCE, jamais face au build pose : c'est l'achat qui se
   * decide, pas l'essai en cours.
   */
  function renderProximite() {
    const etat = lireEtat();
    const catalogue = lireCatalogue();
    renderReglageProximite($('reglage-proximite'), {
      reference: etat.reference,
      max: etat.changementsMax,
      possedees: etat.possedees.size,
      portees: etat.equipped.size,
    }, {
      onFiger: gestesReference.figerReference,
      onOublier: gestesReference.oublierReference,
      onReprendre: gestesReference.reprendreReference,
      onMax: (valeur) => setEtat({ changementsMax: valeur }),
    });

    const paliers = etat.reference ? (etat.paliers ?? []) : [];
    const reference = valeurDeReference(etat, catalogue);
    $('compte-paliers').textContent = String(paliersUtiles(paliers, reference).length);

    renderPaliers($('paliers'), paliers, {
      reference,
      itemById: catalogue?.itemById ?? new Map(),
      piecesReference: etat.reference?.itemIds ?? [],
      max: etat.changementsMax,
      possedees: etat.possedees,
      onPorter: (palier) => {
        recherche.porterAlaMain(palier);
        message(`Stuff porté : ${palier.changements} pièce(s) à acheter, `
          + `${nombre(Math.floor(palier.damage))} de dégâts.`);
      },
      selection: selectionDe('palier', (palier) => `${palier.changements} pièce(s)`),
    });
  }

  /**
   * Les bonus de panoplie actifs.
   *
   * Le compte en tete est celui que les trophees verifient : (pieces − 1) par
   * panoplie, jamais le nombre de panoplies.
   */
  function renderPanoplie(build) {
    const etat = lireEtat();
    const catalogue = lireCatalogue();
    const sets = build?.sets ?? [];
    $('compte-bonus').textContent = String(
      sets.reduce((n, s) => n + Math.max(0, s.pieces - 1), 0));
    $('bloc-panoplies').hidden = sets.length === 0;

    renderPanoplies($('panoplies'), sets, catalogue?.setById ?? new Map(), STAT_LABELS, {
      itemById: catalogue?.itemById ?? new Map(),
      equippedIds: new Set([...etat.equipped.values()].map((p) => p.id)),
      onPick: (piece) => ouvrirFiche(piece, { onEquip: () => poserPiece(piece) }),
    });
  }

  /**
   * D'ou vient le score, et ou investir pour le monter.
   *
   * Sans piece portee, il n'y a rien a analyser : le bloc disparait plutot que
   * de montrer trois listes vides.
   */
  function renderAnalyseDuStuff(bilan, stats) {
    const etat = lireEtat();
    const catalogue = lireCatalogue();
    const bloc = $('bloc-analyse');
    bloc.hidden = !bilan || etat.equipped.size === 0;
    if (bloc.hidden) return;

    renderAnalyse(
      { apports: $('apports'), sensibilite: $('sensibilite'), remplacements: $('remplacements') },
      {
        etat,
        catalogue,
        stats,
        cible: cibleAffichee(etat),
        tenu: bilan.satisfied,
        enRecherche: recherche.tourne(),
        contexte: {
          level: etat.niveau,
          allocation: etat.allocation,
          scrolls: etat.scrolls,
          passives: passifsActifs(etat),
          profile: profilDe(etat),
          setById: catalogue.setById,
        },
        onRemplacer: (proposition) => {
          setEtat(remplacer(lireEtat(), proposition.actuel, proposition.remplacant));
          message(`${proposition.remplacant.fr} posée`
            + `${proposition.actuel ? ` a la place de ${proposition.actuel.fr}` : ''}.`);
        },
      });
  }

  return { renderTrouves, renderProximite, renderPanoplie, renderAnalyseDuStuff };
}
