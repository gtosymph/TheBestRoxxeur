/**
 * Orchestration de v2.
 *
 * v2 est une seconde coquille, pas un second outil. Le moteur, l'etat, la
 * recherche et les panneaux viennent de `src/` et de `web/` sans copie : ce
 * module ne fait que poser une autre mise en page par-dessus, et se branche
 * aux modules de v1 par le pont. Tant que les deux ecrans vivent cote a cote,
 * une correction dans le moteur profite aux deux le meme jour.
 *
 * Ce qui lui appartient en propre : l'ecran vide, les trois volets, et l'ordre
 * dans lequel un debutant rencontre les concepts. Le reste est emprunte.
 *
 * Chaque section de l'ecran se dessine dans son module (`rendu-*.mjs`) ; ce
 * fichier tient l'etat, l'annulation, la cadence du rendu et le demarrage.
 */
import { loadCatalog } from '../catalog-web.mjs';
import { loadSpells } from '../spells-data.mjs';
import { avatarDeClasse, emblemeDeClasse, nomDeClasse } from '../classes.mjs';
import { el, renderArme, renderCases, renderCombo } from '../render.mjs';
import { SLOTS_ARTEFACTS, SLOTS_DROITE, SLOTS_GAUCHE } from '../layout.mjs';
import { etatInitial, LIBELLES_OPTIONS } from '../reglages.mjs';
import { etatRange, reprendreEtat, sauverEtat } from '../etat-stockage.mjs';
import { adopter, reglageDuFragment, resume } from '../partage-lien.mjs';
import { attaqueArme, buildCourant, cibleDe, scoreAffiche } from '../objectif.mjs';
import { appliquerBuild, equiperDans, remplacementAuChoix } from '../equipement.mjs';
import { enrichirSorts } from '../sorts-migration.mjs';
import { creerRecherche } from '../recherche.mjs';
import { fermerFiche, ouvrirFiche } from '../item-panel.mjs';
import { normaliserBonusXp } from '../../src/solver/score.mjs';
import { STAT_LABELS } from '../../src/data/stats.mjs';
import { computeSpellDetail } from '../../src/engine/damage.mjs';
import { creerGestesCatalogue } from '../gestes-catalogue.mjs';
import { creerGestesSorts } from '../gestes-sorts.mjs';
import { creerGestesReference } from '../gestes-reference.mjs';
import { installerSimulations } from '../simulations-panel.mjs';
import { basculerExoRare, mettreOver } from '../exos-piece.mjs';
import { VERSION_LUE } from '../version.mjs';

import { creerPont } from './pont.mjs';
import { icone } from './icones.mjs';
import { renderClasses } from './accueil.mjs';
import { garderSignature, reglagesChanges, reprendreSignature } from './peremption.mjs';
import { ouvrirIdentite } from './identite.mjs';
import { basculerPalette, fermerPalette, rafraichirPalette } from './palette.mjs';
import { ouvrirReglages } from './vue-reglages.mjs';
import { ouvrirPartage, proposerReglage } from './vue-partage.mjs';
import { creerCadence } from './cadence.mjs';
import { ouvrirCase } from './vue-case.mjs';
import { ouvrirPlus } from './vue-plus.mjs';
import { ouvrirCombo } from './vue-combo.mjs';
import { visiteAfaire } from './visite.mjs';
import { ouvrirVisite } from './vue-visite.mjs';
import { ouvrirSignaler } from './vue-signaler.mjs';
import { ouvrirJournal } from './vue-journal.mjs';
import { ouvrirImport } from './vue-import.mjs';
import { creerRenduVerdict } from './rendu-verdict.mjs';
import { creerRenduAvoir } from './rendu-avoir.mjs';
import { creerRenduSorts } from './rendu-sorts.mjs';
import { creerRenduInspecteur } from './rendu-inspecteur.mjs';
import { creerRenduListes } from './rendu-listes.mjs';
import { creerComparateur } from './comparateur.mjs';
import { creerGestesMinimums } from './gestes-minimums.mjs';
import { creerJeux } from './jeux-enregistres.mjs';
import { creerEssais } from './essais.mjs';
import { creerVoletsEcran } from './volets-ecran.mjs';
import { brancherClavier } from './clavier.mjs';

const { $, muets } = creerPont({ racine: document, fabrique: (t) => document.createElement(t) });

let etat = etatInitial();
let catalogue = null;
let classesSorts = null;

/** Vrai tant que le joueur n'a pas choisi sa classe : l'ecran vide tient. */
let vierge = true;

/**
 * Reglages qui valaient au dernier lancement, ou null si aucun n'a eu lieu.
 *
 * Il sert a dire que ce qui est a l'ecran repond a une question precedente.
 * Oublier de relancer apres un reglage etait la vraie gene, pas le clic.
 */
let signatureLancement = null;

/**
 * Vrai quand la prochaine recherche doit repartir d'une population neuve.
 *
 * Couper une recherche tue les fils : ce qu'ils avaient en main n'existe plus.
 * Le prochain depart repart donc de zero quoi qu'il arrive, et le bouton n'a
 * plus de raison d'annoncer « Relancer » — il n'y a plus rien a relancer.
 * Sans cet indicateur, la seule facon de faire repartir de zero etait de
 * laisser la peremption allumee, ce qui gardait le mot « Relancer » a l'ecran
 * apres un arret.
 */
let repartDeZero = false;

/** Panneau des essais gardes, installe une fois le catalogue charge. */
let panneauSimulations = null;

const lireEtat = () => etat;

/** Nombre d'etats gardes pour l'annulation. */
const ETATS_GARDES = 30;

/**
 * Etats precedents, du plus ancien au plus recent.
 *
 * L'etat est immuable : garder les versions precedentes suffit a tout
 * annuler, sans une ligne de code par action. « Vider », « Interdire » et
 * « Remettre a zero » deviennent ainsi reversibles, et aucun d'eux n'a besoin
 * de demander confirmation.
 */
const passe = [];

function setEtat(patch) {
  passe.push(etat);
  if (passe.length > ETATS_GARDES) passe.shift();
  etat = { ...etat, ...patch };
  sauverEtat(etat);
  render();
}

/** Revient a l'etat precedent, s'il y en a un. */
function annuler() {
  const precedent = passe.pop();
  if (!precedent) {
    message('Rien à annuler.');
    return;
  }
  etat = precedent;
  sauverEtat(etat);
  render();
}

/** Enleve toutes les pieces portees. L'annulation les repose. */
function vider() {
  setEtat({ equipped: new Map(), posees: new Set() });
  message('Toutes les pièces sont enlevées. Ctrl+Z les repose.');
}

function message(texte, type = 'info') {
  const zone = $('message');
  zone.textContent = texte ?? '';
  zone.className = `message-v2 ${texte ? type : ''}`.trim();
}

/* --------------------------------------------------------------- Recherche --- */

const recherche = creerRecherche({
  $, lireEtat, setEtat, message,
  // Le catalogue se lit au moment ou la recherche part, pas ici : il arrive
  // apres le premier rendu.
  lireCatalogue: () => catalogue,
  appliquer: (resultat, aussi = null) => setEtat(
    { ...appliquerBuild(etat, resultat, catalogue.itemById), ...(aussi ?? {}) }),
  garderSimulation: () => essais.garderSimulation({ siNouvelle: true, silencieux: true }),
});

const lireCatalogue = () => catalogue;

/** Change une option de calcul. */
const poserOption = (cle, valeur) => setEtat({ options: { ...etat.options, [cle]: valeur } });

/* ---------------------------------------------------------------- Gestes --- */

const gestes = creerGestesCatalogue({ lireEtat, lireCatalogue, setEtat, message });

const gestesSorts = creerGestesSorts({
  lireEtat, setEtat, message, lireClassesSorts: () => classesSorts,
});

const gestesReference = creerGestesReference({
  lireEtat, setEtat, message, nomDeClasse, lireRecherche: () => recherche,
});

const gestesMinimums = creerGestesMinimums({ lireEtat, setEtat, message });

const essais = creerEssais({
  lireEtat, setEtat, message, lireCatalogue, lirePanneau: () => panneauSimulations,
});

const jeux = creerJeux({ $, lireEtat, setEtat, message, lireCatalogue });

/* ---------------------------------------------------------------- Rendus --- */

// `render` se lit au moment de l'appel : la cadence est posee plus bas.
const comparateur = creerComparateur({ lireEtat, lireCatalogue, render: () => render() });

const verdict = creerRenduVerdict({
  $, lireEtat, setEtat, message, lireCatalogue, recherche, poserOption,
});

const avoir = creerRenduAvoir({
  $, lireEtat, setEtat, message, lireCatalogue, gestesReference,
  ouvrirListe: (liste) => basculerPalette(liensPalette, liste),
  enleverMinimum: gestesMinimums.enleverMinimum,
});

const rangeeSorts = creerRenduSorts({
  $, lireEtat, setEtat, lireCatalogue, lireClassesSorts: () => classesSorts, gestesSorts,
});

const inspecteur = creerRenduInspecteur({
  $, lireEtat, setEtat, lireCatalogue, render: () => render(),
  poserMinimum: gestesMinimums.poserMinimum,
});

const listes = creerRenduListes({
  $, lireEtat, setEtat, message, lireCatalogue, recherche, gestesReference,
  selectionDe: comparateur.selectionDe,
  poserPiece: (item) => poserPiece(item),
});

const ecran = creerVoletsEcran({ $, lireVierge: () => vierge });

/* ----------------------------------------------------------------- Rendu --- */

/*
 * L'ecran se repeint au rythme de l'oeil, jamais sous un doigt pose.
 *
 * Voir `cadence.mjs` : pendant une recherche, le meilleur build s'applique
 * des qu'il s'ameliore, et chaque application remplacait des noeuds au milieu
 * d'un clic. Le clic se perdait.
 */
const cadence = creerCadence({
  peindre: () => peindre(),
  // Une image d'ecran est le bon moment pour peindre — sauf qu'un onglet en
  // arriere-plan n'en produit aucune. La page s'ouvrait alors vide, et le
  // restait jusqu'a ce qu'on vienne la regarder. Le compte a rebours prend le
  // relais : le premier des deux qui arrive peint, le second ne fait rien.
  //
  // Un delai demande par le rythme se tient, lui, au compte a rebours seul :
  // une image d'ecran arriverait trop tot et annulerait l'attente.
  planifier: (suite, delai = 0) => {
    let fait = false;
    const uneSeuleFois = () => { if (fait) return; fait = true; suite(); };
    if (delai > 0) { setTimeout(uneSeuleFois, delai); return; }
    requestAnimationFrame(uneSeuleFois);
    setTimeout(uneSeuleFois, 120);
  },
});

/*
 * Ecart minimal entre deux repeints PENDANT une recherche.
 *
 * Huit fils rendent chacun une vague par seconde, et chaque amelioration
 * repose le build : l'ecran se repeignait jusqu'a dix fois par seconde. Un
 * repeint complet refait dix-sept sections et recalcule l'analyse du stuff. Le
 * fil principal n'avait plus de quoi faire defiler la page ni recevoir un
 * clic. Quatre repeints par seconde suffisent a l'oeil, et rendent la main.
 */
const RYTHME_EN_RECHERCHE_MS = 250;

const render = () => cadence.demander();

window.addEventListener('pointerdown', cadence.enfoncer, true);
window.addEventListener('pointerup', cadence.relacher, true);
// Un doigt qui sort de l'ecran ne leve jamais : sans cela, l'ecran resterait
// fige jusqu'au prochain clic.
window.addEventListener('pointercancel', cadence.relacher, true);

function peindre() {
  if (vierge) return;

  // Le rythme suit la recherche : serre pendant qu'elle tourne, libre sinon.
  cadence.rythme(recherche.tourne() ? RYTHME_EN_RECHERCHE_MS : 0);

  comparateur.rafraichir();

  const build = buildCourant(etat, catalogue);
  const stats = build?.stats ?? {};
  const bilan = build ? scoreAffiche(etat, stats) : null;
  const degats = verdict.sansSorts() ? null : (Number(bilan?.damage) || 0);

  renderIdentite();
  renderPlateau(stats);
  verdict.renderVerdict(stats, degats);
  verdict.renderObjectif();
  verdict.renderMelangeOuPas(bilan, stats);
  verdict.renderCourbeXpOuPas(bilan, stats);
  rangeeSorts.renderSorts();
  avoir.renderAvoir(stats, degats);
  listes.renderTrouves(bilan);
  listes.renderProximite();
  comparateur.renderComparer($('comparer'));
  listes.renderPanoplie(build);
  listes.renderAnalyseDuStuff(bilan, stats);
  inspecteur.renderInspecteur(stats, degats);
  verdict.renderScore(bilan);
  renderCombo($('carte-combo'), bilan?.combo ?? null, {
    onAppliquer: jeux.appliquerCombo,
    onGarder: jeux.garderCombo,
  });
  const arme = attaqueArme(etat);
  renderArme($('carte-arme'), arme, arme && stats ? computeSpellDetail(arme, stats, cibleDe(etat)) : null);
  renderFraicheur();
  renderArret();
}

/**
 * Le bouton de droite : arreter la recherche, ou revenir en arriere.
 *
 * Les deux gestes ne cohabitent pas. Pendant une recherche, revenir en
 * arriere n'a aucun sens : le solveur repose son build a chaque amelioration,
 * et l'etat d'avant serait efface dans la seconde. Le bouton porte donc le
 * geste qui a un sens a ce moment-la, et le DIT — son dessin et son libelle
 * changent ensemble, rien ne se decide en silence.
 *
 * Ctrl+Z reste l'annulation en toutes circonstances.
 */
function renderArret() {
  const bouton = $('annuler');
  const cherche = recherche.tourne();

  bouton.disabled = cherche ? false : passe.length === 0;
  bouton.title = cherche
    ? 'Coupe la recherche net. Contrairement à la pause, elle ne rend rien : '
      + 'ce que les fils avaient en main est perdu.'
    : 'Annule la dernière action (Ctrl+Z)';
  bouton.replaceChildren(
    icone(cherche ? 'stop' : 'annuler'),
    el('span', { text: cherche ? 'Arrêter' : 'Annuler' }));
}

function renderIdentite() {
  $('identite-img').src = avatarDeClasse(etat.classe, etat.sexe);
  $('identite-nom').textContent = nomDeClasse(etat.classe);
  $('identite-detail').textContent = `${etat.niveau} · ${etat.sexe ? '♀' : '♂'}`;
}

function renderPlateau(stats) {
  const colonne = (id, cles) => {
    const noeud = $(id);
    renderCases(noeud, cles, etat.equipped, etat.posees,
      (cle, item) => ouvrirFicheDe(cle, item), etat.verrous, stats);
    return noeud;
  };

  const plateau = $('plateau');
  if (!plateau.firstChild) {
    plateau.replaceChildren(
      el('div', { class: 'colonne-cases', id: 'cases-gauche' }),
      el('div', { class: 'avatar-v2' }, el('img', { id: 'avatar-image', alt: '' })),
      el('div', { class: 'colonne-cases', id: 'cases-droite' }),
      el('div', { class: 'rangee-artefacts', id: 'cases-artefacts' }));
  }
  colonne('cases-gauche', SLOTS_GAUCHE);
  colonne('cases-droite', SLOTS_DROITE);
  colonne('cases-artefacts', SLOTS_ARTEFACTS);
  $('avatar-image').src = avatarDeClasse(etat.classe, etat.sexe);
}

/**
 * Dit si ce qui est a l'ecran repond encore aux reglages courants.
 *
 * Le bouton ne se contente pas de changer de mot : il porte une pastille, car
 * un libelle seul se lit mal dans une barre ou rien d'autre ne bouge.
 *
 * Il faut cependant qu'il y ait quelque chose a perimer. La signature du
 * dernier lancement survit au rechargement, mais pas les propositions qu'il
 * a rendues : `candidats`, `paliers` et `survie` ne sont pas ranges avec
 * l'etat. Une session neuve ouvrait donc sur « Relancer » et une pastille
 * d'alerte devant un ecran vide, ce qui promettait un ecart la ou il n'y
 * avait rien du tout.
 */
function renderFraicheur() {
  const montre = [etat.candidats, etat.paliers, etat.survie]
    .some((liste) => (liste ?? []).length > 0);
  const perime = montre && reglagesChanges(signatureLancement, etat);
  const bouton = $('lancer');
  bouton.classList.toggle('rappel', perime);
  // Le bouton se reconstruit en entier : ecrire son texte seul effaçait le
  // pictogramme pose au demarrage, et « Chercher » restait le seul des cinq
  // a n'avoir aucune image.
  bouton.replaceChildren(
    ...(perime ? [el('span', { class: 'puce' })] : [icone('play')]),
    el('span', { text: perime ? 'Relancer' : 'Chercher' }));
  bouton.title = perime
    ? 'Un réglage a bougé depuis la dernière recherche : ce qui est montré '
      + 'repond a la question d\'avant.'
    : '';
}

/* ------------------------------------------------------------- Ouvertures --- */

/**
 * Ouvre la fiche d'une piece portee, avec ce qu'on peut en faire.
 *
 * Une fiche qui ne sait que se fermer laisse le joueur devant un mur : il a
 * clique pour agir autant que pour lire. Les quatre gestes sont ceux de v1,
 * empruntes tels quels.
 */
function ouvrirFicheDe(cle, item) {
  const build = buildCourant(etat, catalogue);
  ouvrirFiche(item, {
    stats: build?.stats ?? null,
    cible: cibleDe(etat),
    onRemove: () => gestes.retirer(cle),
    onLock: () => gestes.verrouiller(item),
    verrouille: etat.verrous.has(item.id),
    onBan: () => gestes.bannir(item),
    banni: etat.bannis.has(item.id),
    onPosseder: () => gestes.basculerPossedee(item),
    possedee: etat.possedees.has(item.id),
    // Forgemagie : la fiche se rouvre sur le nouvel etat, pour que le geste
    // se lise tout de suite.
    exo: etat.exos[item.id] ?? null,
    onExoRare: (exoCle) => {
      try {
        setEtat({ exos: basculerExoRare(etat.exos, item.id, exoCle, item) });
        ouvrirFicheDe(cle, item);
      } catch (erreur) {
        message(erreur.message, 'erreur');
      }
    },
    onOver: (stat, valeur) => {
      setEtat({ exos: mettreOver(etat.exos, item.id, stat, valeur) });
      ouvrirFicheDe(cle, item);
    },
  });
}

/* ------------------------------------------------------------------- Boot --- */

/**
 * Propose la visite au premier passage, et une seule fois.
 *
 * Elle attend que l'atelier soit pose : une lucarne mesuree avant la mise en
 * page se poserait a cote de la commande qu'elle montre.
 */
function proposerVisiteUneFois() {
  if (vierge || !visiteAfaire()) return;
  setTimeout(() => { if (!vierge && visiteAfaire()) ouvrirVisite({ message }); }, 600);
}

/**
 * Pose une piece, en demandant quelle case remplacer quand c'est necessaire.
 *
 * Tant qu'une case de la famille est libre, la piece s'y pose sans un mot.
 * Quand elles sont toutes prises — six dofus, deux anneaux — l'outil ecrasait
 * la derniere en silence : la question se pose maintenant.
 */
function poserPiece(item) {
  if (!remplacementAuChoix(etat, item)) {
    gestes.equiper(item);
    return;
  }

  ouvrirCase({
    etat,
    item,
    onChoisir: (cle) => {
      const patch = equiperDans(etat, item, cle);
      if (!patch) return;
      setEtat(patch);
      message(`« ${item.fr ?? item.name} » prend la place ${cle.split(':')[1] * 1 + 1}.`);
    },
  });
}

function choisirClasse(classe) {
  vierge = false;
  $('accueil').hidden = true;
  $('travail').hidden = false;
  $('identite').hidden = false;
  $('barre-droite').hidden = false;
  $('barre-volets').hidden = false;
  ecran.placerCommandes();
  setEtat({ classe });
  recherche.lancer();
  proposerVisiteUneFois();
}

/**
 * Accueille un reglage arrive par un lien.
 *
 * Il ne se pose pas tout seul. Quelqu'un qui travaille depuis une heure ne
 * doit pas perdre sa seance parce qu'il a ouvert le lien d'un ami : l'ecran
 * dit ce que le lien porte, et attend.
 *
 * Le fragment s'efface des qu'il est lu, avant meme la reponse. Sans cela un
 * rechargement reposerait la meme question, et le lien collerait a la page
 * longtemps apres avoir ete repondu.
 */
async function accueillirLien() {
  const forme = await reglageDuFragment(location.hash);
  if (!forme) return;
  history.replaceState(null, '', location.pathname + location.search);

  proposerReglage({
    compte: resume(forme, catalogue),
    nomDeClasse,
    onAdopter: () => {
      const recu = adopter(forme, catalogue);

      // Le lien ne porte que les identifiants des sorts : le catalogue les
      // refabrique. Un sort qu'il ne connait pas — classe changee, sort
      // retire du jeu — repartirait sans aucune ligne de degats et compterait
      // pour zero sans le dire. Mieux vaut ne pas le poser et l'annoncer.
      const { sorts } = enrichirSorts(recu.sorts, classesSorts, recu.niveau);
      const tenus = sorts.filter((sort) => (sort.lines ?? []).length > 0);
      setEtat({ ...recu, sorts: tenus });

      // Le reglage recu pose une question neuve : rien a l'ecran n'y repond
      // encore, et le bouton ne doit pas annoncer une peremption.
      signatureLancement = garderSignature(etat);
      repartDeZero = true;

      if (vierge) {
        vierge = false;
        $('accueil').hidden = true;
        $('travail').hidden = false;
        $('identite').hidden = false;
        $('barre-droite').hidden = false;
        $('barre-droite').style.display = 'flex';
      }
      const perdus = sorts.length - tenus.length;
      message(perdus > 0
        ? `Réglage adopte, sans ${perdus} sort(s) que le catalogue ne connaît pas. `
          + 'Ctrl+Z rend le votre.'
        : 'Réglage adopte. Ctrl+Z rend le votre.');
      render();
    },
  });
}

async function main() {
  $('version').textContent = VERSION_LUE;
  // La pastille ouvre le journal : le numero seul ne dit rien de ce qui a
  // change, et c'est pourtant la seule question qu'on lui pose.
  $('version').onclick = ouvrirJournal;
  ecran.placerCommandes();
  ecran.montrerVolets();

  // Les noeuds que la nouvelle coquille ne montre plus vivent quand meme dans
  // le document : un champ hors de l'arbre ne garde pas sa valeur de facon
  // fiable, et les modules de v1 les lisent au lancement.
  document.body.append(...muets.values());

  // Chaque commande recoit son dessin avant son libelle. Ceux de « Chercher »
  // et d'« Annuler » changent avec ce qu'ils font : ils se posent au rendu.
  for (const [id, nom] of [['arreter', 'pause'], ['vider', 'poubelle'],
    ['partager', 'partage'], ['importer', 'importer'], ['signaler', 'megaphone'],
    ['visite', 'boussole'], ['reglages', 'engrenage']]) {
    $(id).prepend(icone(nom));
  }

  renderClasses($('classes'), choisirClasse);
  message('Chargement du catalogue…');

  try {
    [catalogue, classesSorts] = await Promise.all([loadCatalog(), loadSpells()]);
    etat = reprendreEtat(etat, catalogue);

    const { sorts, changes } = enrichirSorts(etat.sorts, classesSorts, etat.niveau);
    if (changes) etat = { ...etat, sorts };

    // Un etat range dit que le joueur est deja venu : l'ecran vide n'a plus
    // rien a demander, il ouvrirait une question deja repondue.
    //
    // La question se pose au RANGEMENT, pas aux pieces portees. Un profil
    // repris peut ne porter ni piece ni sort — une classe, un niveau et des
    // minimums font deja un reglage — et l'ecran vide le cachait entier.
    if (etatRange()) {
      vierge = false;
      $('accueil').hidden = true;
      $('travail').hidden = false;
      $('identite').hidden = false;
      $('barre-droite').hidden = false;
      $('barre-volets').hidden = false;
      ecran.placerCommandes();
    }

    // Les resultats ranges reviennent avec l'etat : ils doivent etre juges
    // face aux reglages du lancement qui les a produits, pas face a rien.
    signatureLancement = reprendreSignature();

    panneauSimulations = installerSimulations($('simulations'), {
      compteur: $('compte-simulations'),
      itemById: () => catalogue?.itemById ?? new Map(),
      libelles: STAT_LABELS,
      // Les options se lisent par leur libelle, pas par leur cle interne.
      libellesOptions: LIBELLES_OPTIONS,
      nomDeClasse,
      embleme: emblemeDeClasse,
      onRestaurer: essais.restaurerSimulation,
      onFiger: gestesReference.figerSimulation,
      onGarder: () => essais.garderSimulation(),
      onMessage: (texte) => message(texte),
      selection: comparateur.selectionDe('essai', (simulation) => simulation.nom
        || `${nomDeClasse(simulation.classe)} ${simulation.niveau}`),
    });

    jeux.remplirListesSets();
    message('');
    recherche.reprendre();
    render();
    await accueillirLien();
    proposerVisiteUneFois();
  } catch (erreur) {
    message(`Catalogue indisponible : ${erreur.message}`, 'erreur');
  }
}

/*
 * « Chercher » repart de zero quand la question a change.
 *
 * Une population porte les reponses a la question qu'on lui a posee. Reprendre
 * cette population apres avoir change de sorts, de minimums ou d'objectif
 * revient a chercher la nouvelle reponse en partant des anciennes — le
 * solveur y met longtemps a oublier, et le compteur de generations continue
 * comme si de rien n'etait. v1 laissait le joueur trancher avec un bouton
 * « Recommencer » ; ici l'outil sait deja que la question a bouge, puisqu'il
 * l'annonce sur le bouton.
 */
$('lancer').addEventListener('click', () => {
  const montre = [etat.candidats, etat.paliers, etat.survie]
    .some((liste) => (liste ?? []).length > 0);
  const deZero = repartDeZero || (montre && reglagesChanges(signatureLancement, etat));
  signatureLancement = garderSignature(etat);
  repartDeZero = false;
  recherche.lancer({ deZero });
  render();
});
$('recommencer').addEventListener('click', () => {
  signatureLancement = garderSignature(etat);
  repartDeZero = false;
  recherche.lancer({ deZero: true });
  render();
});
$('arreter').addEventListener('click', () => recherche.arreter());
$('annuler').addEventListener('click', () => {
  if (recherche.abandonner()) {
    message('Recherche coupée. Rien n\'en a été gardé.');
    // L'arret solde la question posee : le bouton redevient « Chercher ».
    // Le depart de zero, lui, ne se perd pas — il passe par l'indicateur.
    signatureLancement = garderSignature(etat);
    repartDeZero = true;
    render();
    return;
  }
  annuler();
});
$('appel-sorts').addEventListener('click', gestesSorts.ouvrir);
$('identite').addEventListener('click', () => ouvrirIdentite({ lireEtat, setEtat }));

/**
 * La fiche d'une piece que l'on REGARDE, sans la porter.
 *
 * C'est le geste des trois listes : on y vient pour voir ce qu'on a, et le
 * plus souvent pour defaire — lever une interdiction, sortir une piece de la
 * banque. Poser la piece a la place fermerait la liste et changerait le stuff
 * pour rien.
 */
function ouvrirFicheLibre(item) {
  const build = buildCourant(etat, catalogue);
  const relire = () => { rafraichirPalette(); ouvrirFicheLibre(item); };
  ouvrirFiche(item, {
    stats: build?.stats ?? null,
    cible: cibleDe(etat),
    onEquip: () => { fermerFiche(); fermerPalette(); poserPiece(item); },
    onBan: () => { gestes.bannir(item); relire(); },
    banni: etat.bannis.has(item.id),
    onPosseder: () => { gestes.basculerPossedee(item); relire(); },
    possedee: etat.possedees.has(item.id),
  });
}

const liensPalette = {
  lireEtat, lireCatalogue: () => catalogue, setEtat,
  // Dans une des trois listes, le clic OUVRE la piece ; ailleurs, il la pose.
  onPiece: (item) => (etat.filtreAvoir
    ? ouvrirFicheLibre(item)
    : (fermerPalette(), poserPiece(item))),
};
$('ouvrir-palette').addEventListener('click', () => basculerPalette(liensPalette));
$('bonus-xp-valeur').addEventListener('change', (ev) => {
  const bonus = normaliserBonusXp(ev.target.value);
  ev.target.value = String(bonus);
  setEtat({ bonusXp: bonus });
});

brancherClavier({
  basculerPalette: () => basculerPalette(liensPalette),
  annuler,
});

$('comparer').addEventListener('click', comparateur.comparer);

jeux.brancher();

// Le graphe vit dans un canvas : il ne suit pas la cascade. Replier une
// section change sa largeur, donc il faut le redessiner.
window.addEventListener('copyroxx:theme', () => render());

// « Recommencer » est branche plus haut, avec « Chercher » : un deuxieme
// ecouteur ici lancait la recherche deux fois par clic.
$('vider').addEventListener('click', vider);
$('reglages').addEventListener('click',
  () => ouvrirReglages({ lireEtat, onOption: poserOption }));
$('partager').addEventListener('click', () => ouvrirPartage({ lireEtat, message }));
$('importer').addEventListener('click',
  () => ouvrirImport({ lireEtat, setEtat, message, lireCatalogue: () => catalogue }));
$('regler-combo').addEventListener('click',
  () => ouvrirCombo({ lireEtat, onOption: poserOption }));
$('visite').addEventListener('click', () => ouvrirVisite({ message }));
$('signaler').addEventListener('click',
  () => ouvrirSignaler({ lireEtat, nomDeClasse, message }));
ecran.brancher();
$('plus').addEventListener('click', () => ouvrirPlus());

main();
