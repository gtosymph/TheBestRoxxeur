/**
 * Les jeux enregistres : sorts, minimums, stuff, banque et interdits.
 *
 * Chaque nature a sa liste deroulante et ses deux gestes, enregistrer et
 * reposer. Le combo du moteur s'enregistre aussi comme un jeu de sorts.
 */
import { el } from '../render.mjs';
import { brancherSets } from '../branchements.mjs';
import { enregistrerSet, lireSets } from '../presets.mjs';

/** Natures de jeux enregistres, et la liste qui les montre. */
export const NATURES_JEUX = Object.freeze([
  'sorts', 'conditions', 'stuff', 'banque', 'bannis',
]);

/**
 * @param {object} liens
 * @param {(id: string) => HTMLElement} liens.$
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 * @param {() => any} liens.lireCatalogue
 */
export function creerJeux({ $, lireEtat, setEtat, message, lireCatalogue }) {
  /**
   * Remplit les listes de jeux enregistres.
   *
   * Le choix courant se garde s'il existe encore : recharger la liste apres un
   * enregistrement ne doit pas faire sauter la selection du joueur.
   */
  function remplirListesSets() {
    for (const [nature, id] of NATURES_JEUX.map((n) => [n, `sets-${n}`])) {
      const noeud = $(id);
      const choisi = noeud.value;
      const jeux = lireSets(nature);

      noeud.replaceChildren(...(jeux.length === 0
        ? [el('option', { value: '', text: 'aucun jeu enregistré' })]
        : jeux.map((j) => el('option', { value: j.nom, text: j.nom }))));

      if (choisi && jeux.some((j) => j.nom === choisi)) noeud.value = choisi;
    }
  }

  /**
   * Les sorts d'un combo, avec le nombre de lancers qu'il leur donne.
   *
   * Le nombre de lancers va dans « repeats » : c'est ce champ que les degats
   * comptent. « castsPerTurn » reste la limite du jeu, elle ne bouge pas.
   */
  function sortsDuCombo(combo) {
    const parId = new Map(lireEtat().sorts.map((s) => [s.id, s]));
    return combo.lancers
      .map((lancer) => {
        const base = parId.get(lancer.id);
        return base ? { ...base, repeats: lancer.lancers } : null;
      })
      .filter(Boolean);
  }

  /** Enregistre le combo comme un jeu de sorts. */
  function garderCombo(combo) {
    const sorts = sortsDuCombo(combo);
    if (sorts.length === 0) return;
    const nom = window.prompt('Nom du jeu de sorts :', 'combo');
    if (nom === null) return;
    try {
      enregistrerSet('sorts', nom, sorts);
      remplirListesSets();
      $('sets-sorts').value = nom.trim();
      message(`Jeu de sorts « ${nom.trim()} » enregistré depuis le combo.`);
    } catch (erreur) {
      message(erreur.message, 'erreur');
    }
  }

  /** Repose le combo comme liste de sorts. */
  function appliquerCombo(combo) {
    const sorts = sortsDuCombo(combo);
    if (sorts.length === 0) return;
    setEtat({ sorts });
    message(`La liste des sorts reprend le combo : ${sorts.length} sort(s).`);
  }

  /*
   * Ce qu'un jeu garde, et comment il se repose.
   *
   * Les sorts et les minimums sont deja des listes : ils se rangent tels quels.
   * Les trois autres ne le sont pas — deux ensembles d'identifiants et une
   * table de cases — et ne survivraient pas a un aller-retour en JSON sans
   * etre traduits ici. Le stuff se repose par identifiant : une piece disparue
   * du catalogue est ecartee plutot que de laisser une case vide muette.
   */
  const JEUX = Object.freeze({
    sorts: {
      lire: () => lireEtat().sorts,
      poser: (contenu) => setEtat({ sorts: contenu }),
    },
    conditions: {
      lire: () => lireEtat().conditions,
      poser: (contenu) => setEtat({ conditions: contenu }),
    },
    bannis: {
      lire: () => [...lireEtat().bannis],
      poser: (contenu) => setEtat({ bannis: new Set(contenu) }),
    },
    banque: {
      lire: () => [...lireEtat().possedees],
      poser: (contenu) => setEtat({ possedees: new Set(contenu) }),
    },
    stuff: {
      lire: () => [...lireEtat().equipped.entries()].map(([cle, piece]) => [cle, piece.id]),
      poser: (contenu) => {
        const equipped = new Map();
        for (const [cle, id] of contenu ?? []) {
          const piece = lireCatalogue()?.itemById.get(id);
          if (piece) equipped.set(cle, piece);
        }
        setEtat({ equipped, posees: new Set(equipped.keys()) });
      },
    },
  });

  /** Branche les listes et les boutons de chaque nature. */
  function brancher() {
    for (const nature of NATURES_JEUX) {
      brancherSets({
        $, message, remplirListesSets, nature,
        idListe: `sets-${nature}`,
        lire: JEUX[nature].lire,
        poser: JEUX[nature].poser,
      });
    }
  }

  return { remplirListesSets, garderCombo, appliquerCombo, brancher };
}
