/**
 * Les deux volets et le quai, poses sur l'ecran.
 *
 * Voir `volets.mjs` : l'etat se calcule la, ce module ne fait que le porter.
 */
import {
  basculer, choisirOnglet, classesDeVolets, garderVolets, LARGEUR_ETROITE,
  LARGEUR_TELEPHONE, lireVolets, ongletCourant, ouvertureDepart,
} from './volets.mjs';

/** Vrai quand les trois colonnes ne tiennent plus cote a cote. */
const ecranEtroit = () => window.innerWidth <= LARGEUR_ETROITE;

/** Vrai quand l'ecran ne montre plus qu'une zone a la fois. */
const surTelephone = () => window.innerWidth <= LARGEUR_TELEPHONE;

/*
 * Les commandes de la recherche demenagent, elles ne se dupliquent pas.
 *
 * Sur telephone elles descendent dans le quai, sous le pouce ; ailleurs elles
 * remontent dans la barre, a leur place exacte. Un second jeu de boutons
 * aurait demande de tenir deux etats d'accord — un « Pause » grise en haut et
 * vif en bas — et cet ecart-la se voit toujours au pire moment.
 */
const COMMANDES_DU_QUAI = ['lancer', 'arreter', 'annuler', 'partager'];

/**
 * @param {object} liens
 * @param {(id: string) => HTMLElement} liens.$
 * @param {() => boolean} liens.lireVierge Vrai tant que l'ecran d'accueil tient.
 */
export function creerVoletsEcran({ $, lireVierge }) {
  let volets = ouvertureDepart({ garde: lireVolets(), etroit: ecranEtroit() });

  /** Ou chaque commande retourne quand l'ecran s'elargit. */
  const attaches = new Map();

  /**
   * Deplace les commandes vers le quai, ou les rend a la barre.
   *
   * Le retour se fait dans l'ordre INVERSE, et ce n'est pas un detail. Chaque
   * commande retient le frere devant lequel elle se remet — et ce frere est
   * presque toujours une autre commande du meme lot. Les quatre quittent la
   * barre ensemble ; en les rendant dans l'ordre, la premiere cherchait a se
   * poser devant une voisine encore dans le quai, `insertBefore` levait une
   * NotFoundError, et la boucle s'arretait la.
   *
   * La consequence se voyait : les quatre boutons restaient dans un quai que
   * la feuille de style cache au-dessus de sept cent vingt pixels. « Chercher »,
   * « Pause », « Annuler » et « Partager » DISPARAISSAIENT de l'ecran des qu'une
   * fenetre etroite s'elargissait. A l'envers, chaque frere est deja rentre
   * quand on en a besoin.
   */
  function placerCommandes() {
    const quai = $('quai');
    const versLeQuai = surTelephone();
    // Le quai commande l'atelier : sur l'ecran d'accueil il n'y a rien a
    // commander, et une barre d'onglets y montrerait trois ecrans vides.
    quai.hidden = !versLeQuai || lireVierge();

    const ordre = versLeQuai ? COMMANDES_DU_QUAI : [...COMMANDES_DU_QUAI].reverse();

    for (const id of ordre) {
      const bouton = $(id);
      if (!attaches.has(id)) attaches.set(id, [bouton.parentNode, bouton.nextSibling]);

      if (versLeQuai) {
        $('quai-actions').insertBefore(bouton, $('plus'));
      } else {
        const [parent, suivant] = attaches.get(id);
        // Le filet : un repere qu'un rendu aurait remplace ne doit pas faire
        // disparaitre un bouton. A la pire place plutot que nulle part.
        if (suivant && suivant.parentNode === parent) parent.insertBefore(bouton, suivant);
        else parent.append(bouton);
      }
    }
  }

  /** Pose l'etat des volets sur l'ecran. */
  function montrerVolets() {
    const etroit = ecranEtroit();
    const appli = $('travail');
    appli.classList.remove('gauche-replie', 'droit-replie', 'volets-flottants');
    appli.classList.add(...classesDeVolets(volets, etroit));

    for (const cote of ['gauche', 'droit']) {
      $(`bascule-${cote}`).setAttribute('aria-pressed', String(volets[cote]));
    }
    // Le voile ne sert qu'a refermer un volet pose PAR-DESSUS le milieu. Sur
    // telephone les zones sont des ecrans : il n'y a rien dessous a decouvrir.
    $('volets-voile').hidden = !etroit || surTelephone()
      || (!volets.gauche && !volets.droit);

    const courant = ongletCourant(volets);
    for (const onglet of $('quai-onglets').children) {
      onglet.setAttribute('aria-selected', String(onglet.dataset.onglet === courant));
    }
  }

  /** Ouvre ou replie un volet, et garde le choix. */
  function basculerVolet(cote) {
    const etroit = ecranEtroit();
    volets = basculer(volets, cote, etroit);
    garderVolets(volets, etroit);
    montrerVolets();
  }

  /** Va sur un des trois ecrans du telephone. */
  function allerA(onglet) {
    volets = choisirOnglet(volets, onglet);
    montrerVolets();
  }

  /** Branche les bascules, le voile, les onglets du quai et le redimensionnement. */
  function brancher() {
    $('bascule-gauche').addEventListener('click', () => basculerVolet('gauche'));
    $('bascule-droit').addEventListener('click', () => basculerVolet('droit'));
    $('volets-voile').addEventListener('click', () => {
      volets = { gauche: false, droit: false };
      montrerVolets();
    });

    // Un ecran qui passe d'etroit a large change ce qu'un volet ouvert veut
    // dire : il occupait le milieu, il reprend sa colonne.
    window.addEventListener('resize', () => { placerCommandes(); montrerVolets(); });

    for (const onglet of $('quai-onglets').children) {
      onglet.addEventListener('click', () => allerA(onglet.dataset.onglet));
    }
  }

  return { placerCommandes, montrerVolets, brancher };
}
