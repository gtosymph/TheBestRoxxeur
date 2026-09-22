/**
 * Ce qui a change, version par version.
 *
 * La pastille de version disait un numero et rien d'autre. Un joueur qui
 * revient apres trois jours voit « v1.9.0 » sans savoir ce que les trois
 * jours ont apporte, et un joueur qui signale un defaut deja corrige ne
 * peut pas le savoir non plus.
 *
 * Le journal est une DONNEE, pas du dessin : il se lit, il se teste, et un
 * test le confronte a la version publiee. Une version montee sans ligne de
 * journal fait tomber ce test — c'est le seul moyen de ne pas oublier.
 *
 * L'ordre est celui de la lecture : la derniere version d'abord.
 */

/**
 * @typedef {{version: string, date: string, titre: string, points: string[]}} Entree
 */

/** @type {Entree[]} */
export const JOURNAL = Object.freeze([
  {
    version: '1.9.1',
    date: '2026-09-22',
    titre: 'La fiche d\'une piece passe au-dessus',
    points: [
      'La fiche d\'une pièce ouverte depuis une liste s\'affichait DERRIÈRE '
        + 'la palette : on cliquait une pièce et rien ne semblait se produire.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-09-22',
    titre: 'Voir ce que l\'on a deja',
    points: [
      'Les trois listes du joueur se LISENT enfin : la banque, les pièces '
        + 'interdites et le stuff figé. Le volet gauche en donnait le compte, '
        + 'et aucun chemin ne menait aux pièces elles-mêmes.',
      'Chaque ligne de « Ce que j\'ai » ouvre sa liste dans la palette.',
      'Les trois listes se croisent avec les filtres ordinaires : « mes '
        + 'anneaux en banque » est une question qui se pose maintenant.',
      'Dans une liste, un clic ouvre la fiche de la pièce — équiper, '
        + 'interdire, je l\'ai déjà — au lieu de la poser.',
      'Voir son stuff figé et l\'oublier sont deux gestes séparés. Un clic '
        + 'distrait ne perd plus la référence.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-09-21',
    titre: 'Les lancers au choix, et la courbe du mode Monter',
    points: [
      'Chaque sort porte son nombre de lancers, borné par la limite du jeu. '
        + 'Ce nombre entre dans les dégâts, donc dans la recherche.',
      'Le mode Monter montre une courbe : chaque point est le stuff le plus '
        + 'sage à un niveau de dégâts donné, et un clic le porte.',
      'La valeur d\'un minimum se règle dans le volet de gauche, sans ouvrir '
        + 'la feuille des réglages.',
      'Le mode Monter montre le multiplicateur d\'XP — « ×9,19 » — au lieu '
        + 'de la vitesse d\'XP, qui est un produit sans unité : elle classe '
        + 'les stuffs, elle ne se lit pas.',
      'La pastille de version ouvre ce journal.',
      'Sept sorts comptaient leur coup deux fois — Pendule, Épidémie, '
        + 'Vacarme, Cryothérapie, Cascade, Moulin Rouge et Sacrifice Vaudou. '
        + 'La correction n\'avait jamais atteint les données livrées.',
      'Soixante-trois sorts avaient perdu leur ligne de poussée : elle est rendue.',
      'Les sorts déjà choisis se remettent en accord avec le catalogue à '
        + 'chaque ouverture : une correction de données les atteint enfin.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-09-21',
    titre: 'Monter : le stuff qui fait monter le plus vite',
    points: [
      'Un quatrième objectif, « Monter ». La sagesse multiplie l\'XP de '
        + 'chaque combat, les dégâts décident du nombre de combats : la '
        + 'recherche maximise le produit des deux.',
      'Au survol d\'un sort, une infobulle dit son coût, ses limites, ses '
        + 'lignes de dégâts et ce qu\'il rapporte avec le stuff porté.',
      'La règle qui lit les sorts sort du script d\'import et se teste : une '
        + 'règle fausse à cet endroit ne lève aucune erreur, elle ment sur '
        + 'tous les écrans à la fois.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-09-20',
    titre: 'Forgemagie automatique, et l\'interface rendue pendant la recherche',
    points: [
      'Le moteur forge lui-même chaque pièce, selon les règles du jeu : un '
        + 'poids de rune par point, cent-et-un de poids par pièce, et un over '
        + 'ne pousse qu\'une ligne que la pièce porte déjà.',
      'Le choix de la ligne se mesure sur le score : un sort de feu paie '
        + 'l\'intelligence, une recherche de survie paie la vitalité.',
      'La navigation, les clics et les boutons Pause, Arrêter et Relancer '
        + 'répondent au premier clic pendant une recherche.',
      'La comparaison montre les vignettes des pièces, les dégâts de chaque '
        + 'sort et la forgemagie de chaque colonne.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-09-20',
    titre: 'Forgemagie : les exos rares et les overs',
    points: [
      'Le joueur pose ses exos rares — PA, PM, portée — et l\'over de chaque '
        + 'ligne depuis la fiche d\'une pièce portée.',
      'Le solveur pose lui-même des exos rares, selon un budget par type.',
      'Les exos suivent la pièce : rangement, lien de partage, référence et '
        + 'build appliqué.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-09-20',
    titre: 'Importer un stuff',
    points: [
      'Un lien du Dofus-Stuffer se relit : le niveau, les points, les '
        + 'parchemins et les seize cases.',
      'Une liste de noms collée se reconnaît aussi, sans casse ni accents.',
      'La feuille « Importer » montre les pièces avant de les poser. Le stuff '
        + 'importé devient le stuff porté ET la référence des achats.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-09-19',
    titre: 'La cible, et la borne haute des dégâts',
    points: [
      'Les dégâts tiennent compte des résistances de la cible. Elles se '
        + 'posent à la main, ou se prennent dans le bestiaire : 5 135 monstres.',
      'Sous le score du stuff porté, une borne haute qu\'aucun stuff n\'atteint.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-09-19',
    titre: 'Fin de la v1, données du lundi, aperçu des liens',
    points: [
      'L\'ancien écran quitte le dépôt : tout vit dans l\'atelier.',
      'Le catalogue se rafraîchit chaque lundi, avec un rapport de différence '
        + 'avant fusion.',
      'Un lien partagé montre une image et un résumé.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-09-19',
    titre: 'Six défauts signalés, et un septième trouvé en chemin',
    points: [
      'La pause le dit dès le clic, au lieu de laisser le compteur monter.',
      'Les quatre commandes de la barre ne disparaissaient plus en '
        + 'élargissant la fenêtre — c\'était probablement le vrai « le site bug ».',
      'L\'infobulle ne reste plus collée, un clic sur la courbe porte le '
        + 'stuff, et les accents manquants sont posés.',
      'Le nom d\'un essai gardé se lit en entier sur téléphone.',
      'La recherche s\'arrête d\'elle-même après un nombre de générations réglable.',
      'Les visites se comptent, sans cookie ni bannière.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-09-18',
    titre: 'La première version',
    points: [
      'Une visite guidée en onze étapes, dans l\'ordre des gestes.',
      'L\'enchaînement des sorts se règle contre la liste des sorts, et non '
        + 'à l\'autre bout de l\'écran.',
      'Le signalement passe par un formulaire, sans compte à créer.',
    ],
  },
]);

/** Les numéros de version du journal, du plus récent au plus ancien. */
export const versionsDuJournal = () => JOURNAL.map((e) => e.version);

/**
 * L'entree d'une version, ou null.
 * @param {string} version
 * @returns {Entree|null}
 */
export function entreeDe(version) {
  return JOURNAL.find((e) => e.version === version) ?? null;
}

/**
 * Compare deux numeros de version, du plus petit au plus grand.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function comparerVersions(a, b) {
  const [ma, mia, ca] = String(a).split('.').map(Number);
  const [mb, mib, cb] = String(b).split('.').map(Number);
  return (ma - mb) || (mia - mib) || (ca - cb);
}

/** La date d'une entree, telle qu'elle se lit. */
export function dateLue(date) {
  const [annee, mois, jour] = String(date).split('-');
  return `${jour}/${mois}/${annee}`;
}
