/**
 * La feuille de l'import : poser un stuff venu de Dofusbook.
 *
 * Deux chemins, parce que Dofusbook n'en laisse que deux ouverts :
 *
 *   - le lien du Dofus-Stuffer porte le stuff entier dans son adresse, et se
 *     relit ici sans reseau — niveau, points, parchemins et pieces ;
 *   - le texte d'une fiche, selectionne et colle, donne des noms d'objets que
 *     le catalogue reconnait un a un.
 *
 * Dans les deux cas, RIEN ne se pose avant que le joueur ait vu ce qui a ete
 * lu. Une piece mal reconnue ou une ligne ignoree se voit dans la liste, pas
 * apres coup sur le personnage. Le stuff pose devient le stuff porte ET la
 * reference : c'est celui du jeu, sinon il ne viendrait pas de la.
 */
import { el } from '../render.mjs';
import { piegerFocus } from '../focus-piege.mjs';
import { lireLienDofusbook } from '../../src/partage/dofusbook-import.mjs';
import { reconnaitreNoms } from '../../src/partage/import-texte.mjs';
import { patchImport } from '../import-stuff.mjs';
import { LIBELLE_CASE } from '../layout.mjs';

let racine = null;
let libererFocus = null;

/** Ferme la feuille. */
export function fermerImport() {
  if (!racine) return;
  racine.remove();
  racine = null;
  libererFocus?.();
  libererFocus = null;
}

/** Vrai quand la feuille est ouverte. */
export const importOuvert = () => racine !== null;

/** Libelle d'une case, pour la liste des pieces lues. */
const nomDeCase = (cle) => LIBELLE_CASE[cle] ?? cle;

/**
 * Ouvre la feuille de l'import.
 *
 * @param {object} liens
 * @param {() => any} liens.lireEtat
 * @param {(patch: any) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 * @param {() => {items: any[], itemById: Map<number, any>}} liens.lireCatalogue
 */
export function ouvrirImport({ lireEtat, setEtat, message, lireCatalogue }) {
  fermerImport();
  const catalogue = lireCatalogue();

  /** Ce qui a ete lu et attend le mot du joueur. */
  let lu = null;

  const apercu = el('div', { class: 'import-apercu', hidden: true });
  const poser = el('button', { class: 'btn premier', type: 'button', text: 'Porter ce stuff', disabled: true });

  const montrer = (lecture, remarques) => {
    lu = lecture;
    const patch = lecture ? patchImport(lireEtat(), lecture, catalogue.itemById) : null;
    poser.disabled = patch === null;
    apercu.hidden = false;

    const pieces = patch ? [...patch.equipped.entries()] : [];
    apercu.replaceChildren(
      el('div', { class: 'import-lignes' },
        ...pieces.map(([cle, item]) => el('div', { class: 'import-ligne' },
          el('span', { class: 'import-case', text: nomDeCase(cle) }),
          el('span', { class: 'import-nom', text: item.fr }),
          el('small', { text: `niv. ${item.level}` }))),
      ),
      ...remarques.map((texte) => el('p', { class: 'aide', text: texte })),
      el('p', { class: 'aide', text: patch
        ? `${pieces.length} pièce(s) prête(s) à être portées.`
          + (lecture.niveau ? ` Le niveau passe à ${lecture.niveau}, avec les points et les parchemins du lien.` : '')
          + ' Elles deviennent aussi votre stuff de référence.'
        : 'Aucune pièce connue : rien ne sera posé.' }),
    );
  };

  const champLien = el('input', { class: 'champ-lien', type: 'text', placeholder: 'https://www.dofusbook.net/…/dofus-stuffer/objets?stuff=…' });
  const lireLien = () => {
    try {
      const lecture = lireLienDofusbook(champLien.value);
      const itemIds = lecture.pieces.map(([, id]) => id);
      const inconnues = itemIds.filter((id) => !catalogue.itemById.has(id)).length;
      montrer({ ...lecture, itemIds },
        inconnues > 0 ? [`${inconnues} pièce(s) du lien ne sont pas dans le catalogue : elles ne seront pas posées.`] : []);
    } catch (erreur) {
      montrer(null, [erreur.message]);
    }
  };

  const champTexte = el('textarea', { class: 'champ-dire', rows: 6,
    placeholder: 'Coiffe du Comte Harebourg\nCape du Comte Harebourg\nGelano\n…' });
  const lireTexte = () => {
    const { trouves, inconnues } = reconnaitreNoms(champTexte.value, catalogue.items);
    const remarques = inconnues.length > 0
      ? [`${inconnues.length} ligne(s) non reconnue(s) : ${inconnues.slice(0, 5).join(' · ')}${inconnues.length > 5 ? ' …' : ''}`]
      : [];
    montrer(trouves.length > 0 ? { itemIds: trouves.map((t) => t.item.id) } : null,
      trouves.length > 0 ? remarques : [...remarques, 'Aucun nom du catalogue dans ce texte.']);
  };

  poser.addEventListener('click', () => {
    if (!lu) return;
    const { laisses, ...patch } = patchImport(lireEtat(), lu, catalogue.itemById) ?? {};
    if (!patch.equipped) return;
    setEtat(patch);
    fermerImport();
    message(`Stuff importé : ${patch.equipped.size} pièce(s) portées et figées comme référence.`
      + (laisses.length > 0 ? ` ${laisses.length} pièce(s) laissée(s) de côté.` : '')
      + ' Ctrl+Z le rend.', 'info');
  });

  racine = el('div', { class: 'feuille-fond', onClick: (ev) => { if (ev.target === racine) fermerImport(); } },
    el('div', { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Importer' },
      el('div', { class: 'feuille-tete' },
        el('h2', { text: 'Importer un stuff' }),
        el('div', { class: 'pousse' }),
        el('button', { class: 'btn fantome', type: 'button', text: 'Fermer', onClick: fermerImport })),

      el('div', { class: 'feuille-corps' },
        el('h3', { class: 'titre-reglage', text: 'Le lien du Dofus-Stuffer' }),
        el('div', { class: 'ligne-lien' },
          champLien,
          el('button', { class: 'btn', type: 'button', text: 'Lire le lien', onClick: lireLien })),
        el('p', { class: 'aide',
          text: 'Sur Dofusbook, ouvrez votre stuff dans le Dofus-Stuffer et copiez l\'adresse de la page. '
            + 'Elle porte les pièces, le niveau, les points et les parchemins. Elle se lit ici, sans réseau. '
            + 'Un stuff enregistré chez eux, par son numéro, ne se lit pas : leur serveur le refuse.' }),

        el('h3', { class: 'titre-reglage', text: 'Ou le texte de la fiche' }),
        champTexte,
        el('div', { class: 'ligne-lien' },
          el('button', { class: 'btn', type: 'button', text: 'Reconnaître les noms', onClick: lireTexte })),
        el('p', { class: 'aide',
          text: 'Sélectionnez la liste des objets sur la page et collez-la, un nom par ligne. '
            + 'Les noms sont retrouvés dans le catalogue, sans la casse ni les accents. '
            + 'Ce chemin ne porte ni le niveau ni les points.' }),

        apercu,
        el('div', { class: 'ligne-lien' }, poser),
      ),
    ));

  document.body.append(racine);
  libererFocus = piegerFocus(racine);
  champLien.focus();
}
