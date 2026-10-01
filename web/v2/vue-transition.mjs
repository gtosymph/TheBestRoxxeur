/**
 * La feuille « Préparer la transition ».
 *
 * Elle va du stuff actuel (fige) au stuff pose a l'ecran. Le joueur y met le
 * prix de chaque piece a acheter et ses kamas ; la feuille montre les etapes
 * qui gardent ses conditions, et ce qu'il peut faire tout de suite.
 *
 * Les champs se dessinent une fois par ouverture : seul le plan se redessine
 * quand un prix change, sinon le curseur sauterait hors du champ suivant. Le
 * calcul vit dans src/solver/transition.mjs ; ici, on ne fait que le montrer.
 */
import { el } from '../render.mjs';
import { piegerFocus } from '../focus-piege.mjs';
import { CLES, ecrireJson, lireJson } from '../stockage.mjs';
import { apparier, planifierTransition, stuffApres } from '../../src/solver/transition.mjs';
import { piecesDePassage } from '../../src/solver/passage.mjs';
import {
  lireKamas, lireTablePrix, poserPrix, prixDuPlan, prixPerime,
} from '../../src/data/prix.mjs';

import { nombre } from './nombres.mjs';
import { demandeDeTransition } from './transition.mjs';
import { blocPassage } from './rendu-passage.mjs';

let racine = null;
let libererFocus = null;

/** Ferme la feuille. */
export function fermerTransition() {
  if (!racine) return;
  racine.hidden = true;
  libererFocus?.();
  libererFocus = null;
}

/** Vrai quand la feuille est ouverte. */
export const transitionOuverte = () => Boolean(racine) && !racine.hidden;

/** Les prix et les kamas gardes, relus proprement. */
function lireRangement() {
  const brut = lireJson(CLES.prix, {});
  return { table: lireTablePrix(brut?.pieces), kamas: lireKamas(brut?.kamas ?? 0) ?? 0 };
}

const kamas = (n) => `${nombre(n)} kamas`;
const dateCourte = (ms) => new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const noms = (items) => items.map((item) => item.fr).join(', ');

/**
 * Ouvre la feuille.
 *
 * @param {object} liens
 * @param {() => any} liens.lireEtat
 * @param {() => any} liens.lireCatalogue
 */
export function ouvrirTransition({ lireEtat, lireCatalogue }) {
  if (!racine) {
    racine = el('div', { class: 'feuille-fond', hidden: true, onClick: (ev) => {
      if (ev.target === racine) fermerTransition();
    } });
    document.body.append(racine);
  }

  const etat = lireEtat();
  const catalogue = lireCatalogue();
  const demande = demandeDeTransition(etat, catalogue);
  let { table, kamas: disponibles } = lireRangement();
  const plan = el('div', { class: 'transition-plan', 'aria-live': 'polite' });

  const garder = () => ecrireJson(CLES.prix, { pieces: table, kamas: disponibles });

  const aAcheter = apparier(demande.actuel, demande.cible)
    .map((changement) => changement.entrante)
    .filter(Boolean);

  function dessinerPlan() {
    const prix = prixDuPlan(table);
    const resultat = planifierTransition({ ...demande, prix, kamas: disponibles });
    const contenu = contenuDuPlan(resultat);
    const passage = resultat.etapes ? blocDePassage(resultat, prix) : null;
    // Le bloc de passage se lit juste avant la liste des etapes.
    if (passage) contenu.splice(contenu.length - 1, 0, passage);
    // replaceChildren ecrirait « null » pour un bloc absent : on les enleve.
    plan.replaceChildren(...contenu.filter(Boolean));
  }

  /** Les pieces de passage, quand l'etape suivante coute trop. */
  function blocDePassage({ etapes, maintenant }, prix) {
    const { etapesPayables, reste } = maintenant;
    if (etapesPayables >= etapes.length) return null;
    const passage = piecesDePassage({
      porte: stuffApres(demande.actuel, etapes, etapesPayables),
      etape: etapes[etapesPayables],
      cible: demande.cible,
      catalogue: catalogue.items,
      bannis: etat.bannis,
      possedees: demande.possedees,
      prix,
      reste,
      contexte: demande.contexte,
    });
    return blocPassage(passage, {
      numero: etapesPayables + 1,
      champKamas,
      prixDe: (item) => table[item.id]?.kamas ?? null,
      poserPrix: (item, lu) => { table = poserPrix(table, item.id, lu, Date.now()); },
    });
  }

  /**
   * Redessine le plan apres que le focus a quitte le champ.
   *
   * Le plan porte lui-meme des champs (les pieces de passage) : le redessiner
   * pendant l'evenement « change » detruirait le champ ou Tab mene. On attend
   * que le focus arrive, puis on le rend au champ de meme nom.
   */
  function redessiner() {
    setTimeout(() => {
      const libelle = document.activeElement?.getAttribute?.('aria-label');
      dessinerPlan();
      if (libelle && !document.activeElement?.closest?.('.feuille')) {
        racine.querySelector(`[aria-label="${CSS.escape(libelle)}"]`)?.focus();
      }
    }, 0);
  }

  /** Un champ de kamas : une saisie absurde se signale et ne se garde pas. */
  function champKamas(libelle, valeur, poser) {
    return el('input', {
      class: 'n', type: 'text', inputmode: 'decimal', autocomplete: 'off',
      placeholder: '1,5m', value: valeur === null ? '' : nombre(valeur), 'aria-label': libelle,
      onChange: (ev) => {
        const texte = ev.target.value.trim();
        const lu = texte === '' ? null : lireKamas(texte);
        const refuse = texte !== '' && lu === null;
        ev.target.setAttribute('aria-invalid', String(refuse));
        if (refuse) return;
        if (lu !== null) ev.target.value = nombre(lu);
        poser(lu);
        garder();
        redessiner();
      },
    });
  }

  function ligneDePrix(item) {
    if (demande.possedees.has(item.id)) {
      return el('div', { class: 'transition-prix' },
        el('span', { class: 'nom', text: item.fr }),
        el('span', { class: 'etiquette', text: 'En banque' }));
    }
    const note = el('span', { class: 'aide' });
    const noter = () => {
      const entree = table[item.id];
      const perime = prixPerime(entree, Date.now());
      note.textContent = entree ? `prix du ${dateCourte(entree.date || Date.now())}` : 'sans prix';
      note.classList.toggle('att', perime || !entree);
      note.title = perime ? 'Ce prix a plus de 7 jours : vérifiez-le à l\'HDV.' : '';
    };
    noter();
    return el('div', { class: 'transition-prix' },
      el('span', { class: 'nom', text: item.fr }),
      champKamas(`Prix de ${item.fr}`, table[item.id]?.kamas ?? null, (lu) => {
        table = poserPrix(table, item.id, lu, Date.now());
        noter();
      }),
      note);
  }

  racine.replaceChildren(el('div', {
    class: 'feuille large', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Préparer la transition',
  },
    el('div', { class: 'feuille-tete' },
      el('h2', { text: 'Préparer la transition' }),
      el('div', { class: 'pousse' }),
      el('button', { class: 'btn fantome', type: 'button', text: 'Fermer', onClick: fermerTransition })),
    el('div', { class: 'feuille-corps' },
      el('p', { class: 'aide', text: 'Le plan va de votre stuff actuel au stuff posé à l\'écran. '
        + 'Chaque étape garde vos conditions, sans pièce de passage à revendre. '
        + 'Écrivez les prix comme en jeu : « 1 500 000 », « 1,5m » ou « 800k ».' }),
      el('h3', { class: 'titre-reglage', text: 'Prix des pièces à acheter' }),
      el('div', { class: 'transition-prix-liste' }, ...aAcheter.map(ligneDePrix)),
      el('label', { class: 'transition-kamas' },
        el('span', { text: 'Mes kamas' }),
        champKamas('Mes kamas', disponibles, (lu) => { disponibles = lu ?? 0; })),
      plan)));

  dessinerPlan();
  racine.hidden = false;
  libererFocus?.();
  libererFocus = piegerFocus(racine);
  racine.querySelector('.transition-prix input')?.focus();
}

/** Les elements du plan, selon ce que le calcul rend. */
function contenuDuPlan(resultat) {
  if (resultat.prixManquants.length > 0) {
    const n = resultat.prixManquants.length;
    return [el('p', { class: 'note', text: `Mettez le prix de ${n} pièce${n > 1 ? 's' : ''} `
      + `pour voir le plan : ${noms(resultat.prixManquants)}.` })];
  }

  const { etapes, maintenant, coutTotal, depart } = resultat;
  return [
    el('h3', { class: 'titre-reglage',
      text: `Le plan · ${etapes.length} étape${etapes.length > 1 ? 's' : ''} · ${kamas(coutTotal)}` }),
    depart.valide ? null : el('p', { class: 'note att',
      text: 'Votre stuff actuel ne tient pas vos conditions : la première étape les remet.' }),
    blocMaintenant(etapes, maintenant),
    el('ol', { class: 'transition-etapes' }, ...etapes.map((etape, rang) => ligneEtape(etape, rang, maintenant))),
  ];
}

/** Ce que les kamas du joueur permettent tout de suite. */
function blocMaintenant(etapes, { etapesPayables, reste, banque, manque }) {
  const phrases = [];
  if (etapesPayables === etapes.length) {
    phrases.push(`Vos kamas couvrent toute la transition. Il vous reste ${kamas(reste)}.`);
  } else {
    const suivante = etapesPayables + 1;
    if (etapesPayables > 0) {
      phrases.push(`Vous pouvez faire ${etapesPayables > 1 ? `les étapes 1 à ${etapesPayables}` : 'l\'étape 1'} maintenant.`);
    }
    if (banque.length > 0) {
      phrases.push(`Pour l'étape ${suivante}, achetez déjà pour la banque : ${noms(banque)}.`);
    }
    phrases.push(`Il vous manque ${kamas(manque)} pour l'étape ${suivante}.`);
  }
  return el('div', { class: 'transition-maintenant' },
    el('strong', { text: 'Maintenant' }), ...phrases.map((texte) => el('p', { text: texte })));
}

function ligneEtape(etape, rang, { etapesPayables }) {
  const payable = rang < etapesPayables;
  const signe = etape.gain >= 0 ? '+' : '−';
  return el('li', { class: `transition-etape${payable ? ' payable' : ''}` },
    el('div', { class: 'tete' },
      el('strong', { text: `Étape ${rang + 1}` }),
      el('span', { class: 'n', text: kamas(etape.cout) }),
      el('span', { class: `n gain${etape.gain < 0 ? ' perte' : ''}`, text: `score ${signe}${nombre(Math.abs(etape.gain))}` }),
      payable ? el('span', { class: 'etiquette', text: 'Payable' }) : null),
    etape.entrantes.length > 0 ? el('p', { text: `Mettre : ${noms(etape.entrantes)}` }) : null,
    etape.sortantes.length > 0 ? el('p', { class: 'aide', text: `Enlever : ${noms(etape.sortantes)}` }) : null,
    etape.valide ? null : el('p', { class: 'note att',
      text: 'Cette étape ne tient pas toutes vos conditions : le stuff visé ne les tient pas non plus.' }));
}
