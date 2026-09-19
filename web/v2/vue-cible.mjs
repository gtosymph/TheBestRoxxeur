/**
 * La feuille de la cible.
 *
 * Deux facons de dire contre quoi on frappe, et la seconde l'emporte :
 * cinq pourcentages poses a la main, ou des monstres pris dans le bestiaire.
 * Le bestiaire pese six cents kilo-octets : il ne se charge qu'a la premiere
 * ouverture de la feuille, jamais au chargement de la page.
 *
 * Le grade se choisit DANS la liste, avant d'ajouter : un monstre ajoute au
 * mauvais grade demanderait de le retirer puis de le reprendre. Il se
 * rechoisit aussi apres coup, sur la ligne du monstre garde.
 */
import { el } from '../render.mjs';
import { piegerFocus } from '../focus-piege.mjs';
import { normaliserCible, resistancesCible } from '../../src/engine/cible.mjs';
import { chercherMonstres, gradesDe, versCible } from '../../src/data/bestiaire.mjs';
import { ETIQUETTES_ELEMENTS, suiteResistances } from './cible.mjs';

/** Ou vit le bestiaire, relatif a ce module. */
const BESTIAIRE = new URL('../../data/monsters.json', import.meta.url);

let racine = null;
let libererFocus = null;
/** Le bestiaire une fois lu, ou la promesse en cours. */
let bestiaire = null;

/** Lit le bestiaire une seule fois. */
function lireBestiaire() {
  if (!bestiaire) {
    bestiaire = fetch(BESTIAIRE).then((r) => {
      if (!r.ok) throw new Error(`Bestiaire indisponible (${r.status}).`);
      return r.json();
    }).catch((err) => { bestiaire = null; throw err; });
  }
  return bestiaire;
}

/** Ferme la feuille. */
export function fermerCible() {
  if (!racine) return;
  racine.hidden = true;
  libererFocus?.();
  libererFocus = null;
}

/** Vrai quand la feuille est ouverte. */
export const cibleOuverte = () => Boolean(racine) && !racine.hidden;

/** Le choix du grade d'un monstre, un `<select>`. */
function choixGrade(monstre, gradeChoisi, onChange) {
  const grades = gradesDe(monstre);
  const select = el('select', { class: 'grade', 'aria-label': `Grade de ${monstre.nom}`, onChange: (ev) => onChange(Number(ev.target.value)) },
    ...grades.map((g) => el('option', { value: g.grade, text: `Grade ${g.grade} · niv. ${g.niveau}` })));
  select.value = String(gradeChoisi ?? grades[grades.length - 1]?.grade ?? 1);
  return select;
}

/**
 * Ouvre la feuille de la cible.
 *
 * @param {object} liens
 * @param {() => any} liens.lireEtat
 * @param {(patch: object) => void} liens.setEtat
 * @param {(texte: string, type?: string) => void} liens.message
 */
export function ouvrirCible({ lireEtat, setEtat, message }) {
  if (!racine) {
    racine = el('div', { class: 'feuille-fond', hidden: true, onClick: (ev) => {
      if (ev.target === racine) fermerCible();
    } });
    document.body.append(racine);
  }

  const cible = () => normaliserCible(lireEtat().cible);
  const regler = (patch) => { setEtat({ cible: normaliserCible({ ...cible(), ...patch }) }); dessiner(); };

  const gardes = el('div', { class: 'cible-gardes' });
  const moyenne = el('p', { class: 'cible-moyenne n' });
  const manuel = el('div', { class: 'cible-manuel' });
  const recherche = el('input', { type: 'search', placeholder: 'Nom du monstre', 'aria-label': 'Chercher un monstre', onInput: () => chercher() });
  const queBoss = el('input', { type: 'checkbox', id: 'cible-boss', onChange: () => chercher() });
  const niveauMin = el('input', { type: 'number', min: 0, max: 999, placeholder: 'min', 'aria-label': 'Niveau minimum', onInput: () => chercher() });
  const niveauMax = el('input', { type: 'number', min: 0, max: 999, placeholder: 'max', 'aria-label': 'Niveau maximum', onInput: () => chercher() });
  const resultats = el('div', { class: 'cible-resultats', text: 'Chargement du bestiaire…' });

  /** Les grades choisis dans la liste, monstre par monstre. */
  const gradesChoisis = new Map();

  function ajouter(monstre) {
    const deja = cible().monstres;
    if (deja.some((m) => m.id === monstre.id)) {
      message(`« ${monstre.nom} » est déjà dans la cible.`);
      return;
    }
    const choisi = versCible(monstre, gradesChoisis.get(monstre.id));
    if (!choisi) return;
    regler({ monstres: [...deja, choisi] });
  }

  function changerGrade(index, grade) {
    lireBestiaire().then((liste) => {
      const actuel = cible().monstres[index];
      const brut = liste.find((m) => m.id === actuel?.id);
      if (!brut) return;
      regler({ monstres: cible().monstres.map((m, i) => (i === index ? versCible(brut, grade) : m)) });
    }).catch((err) => message(err.message, 'erreur'));
  }

  function chercher() {
    lireBestiaire().then((liste) => {
      const lus = chercherMonstres(liste, {
        terme: recherche.value,
        boss: queBoss.checked,
        niveauMin: niveauMin.value === '' ? undefined : Number(niveauMin.value),
        niveauMax: niveauMax.value === '' ? undefined : Number(niveauMax.value),
      });
      const dedans = new Set(cible().monstres.map((m) => m.id));
      resultats.replaceChildren(...(lus.length === 0
        ? [el('p', { class: 'aide', text: 'Aucun monstre ne répond à cette recherche.' })]
        : lus.map((m) => {
          const select = choixGrade(m, gradesChoisis.get(m.id), (g) => gradesChoisis.set(m.id, g));
          return el('div', { class: `cible-ligne ${dedans.has(m.id) ? 'dedans' : ''}`.trim() },
            el('span', { class: 'cible-nom' },
              m.boss === 2 ? el('span', { class: 'etiquette boss', text: 'Boss' }) : null,
              m.boss === 1 ? el('span', { class: 'etiquette', text: 'Mini-boss' }) : null,
              m.nom,
              el('small', { text: ` · ${m.race}` })),
            select,
            el('button', { class: 'btn fantome', type: 'button', text: dedans.has(m.id) ? 'Déjà là' : 'Ajouter',
              disabled: dedans.has(m.id), onClick: () => ajouter(m) }));
        })));
    }).catch((err) => {
      resultats.replaceChildren(el('p', { class: 'aide', text: err.message }));
    });
  }

  function dessiner() {
    const actuelle = cible();
    const monstres = actuelle.monstres;

    gardes.replaceChildren(...(monstres.length === 0
      ? [el('p', { class: 'aide', text: 'Aucun monstre choisi : les pourcentages posés à la main s\'appliquent.' })]
      : monstres.map((m, index) => el('div', { class: 'cible-ligne gardee' },
        el('span', { class: 'cible-nom', text: m.nom }),
        el('span', { class: 'n cible-res', text: suiteResistances(m.res) }),
        el('span', { class: 'cible-grade-garde', text: `grade ${m.grade}` }),
        el('button', { class: 'btn fantome', type: 'button', text: 'Retirer',
          onClick: () => regler({ monstres: monstres.filter((_, i) => i !== index) }) })))));

    moyenne.textContent = monstres.length > 1
      ? `Moyenne retenue · ${suiteResistances(resistancesCible(actuelle))}`
      : '';

    manuel.replaceChildren(...ETIQUETTES_ELEMENTS.map(([cle, nom]) => {
      const champ = el('input', { type: 'number', min: -100, max: 100, step: 1, 'aria-label': `Résistance ${nom}`,
        value: actuelle.manuel[cle], disabled: monstres.length > 0,
        onChange: (ev) => regler({ manuel: { ...cible().manuel, [cle]: Number(ev.target.value) } }) });
      return el('label', { class: 'cible-champ' }, el('span', { text: nom }), champ, el('span', { class: 'unite', text: '%' }));
    }));

    // Le grade d'un monstre garde se rechoisit sur sa ligne.
    gardes.querySelectorAll('.cible-ligne.gardee').forEach((ligne, index) => {
      lireBestiaire().then((liste) => {
        const brut = liste.find((m) => m.id === monstres[index].id);
        if (!brut) return;
        ligne.querySelector('.cible-grade-garde')?.replaceWith(
          choixGrade(brut, monstres[index].grade, (g) => changerGrade(index, g)));
      }).catch(() => {});
    });

    chercher();
  }

  racine.replaceChildren(el('div', {
    class: 'feuille large', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'La cible',
  },
    el('div', { class: 'feuille-tete' },
      el('h2', { text: 'Contre quoi frappez-vous ?' }),
      el('div', { class: 'pousse' }),
      el('button', { class: 'btn fantome', type: 'button', text: 'Fermer', onClick: fermerCible })),

    el('div', { class: 'feuille-corps' },
      el('h3', { class: 'titre-reglage', text: 'Monstres choisis' }),
      gardes,
      moyenne,
      el('p', { class: 'aide', text: 'Avec plusieurs monstres, les dégâts se comptent contre la moyenne de leurs résistances, élément par élément.' }),

      el('h3', { class: 'titre-reglage', text: 'À la main' }),
      manuel,

      el('h3', { class: 'titre-reglage', text: 'Bestiaire' }),
      el('div', { class: 'cible-filtres' },
        recherche,
        el('label', { class: 'case' }, queBoss, ' Boss et mini-boss seulement'),
        el('span', { class: 'cible-niveaux' }, 'Niveau ', niveauMin, ' à ', niveauMax)),
      resultats,
      el('div', { class: 'rangee-ajout' },
        el('button', { class: 'btn fantome', type: 'button', text: 'Vider la cible',
          onClick: () => { setEtat({ cible: normaliserCible(null) }); dessiner(); } })),
    ),
  ));

  dessiner();
  racine.hidden = false;
  libererFocus?.();
  libererFocus = piegerFocus(racine);
}

/**
 * Le bloc sous le nombre de degats : la phrase et le bouton qui ouvre.
 * @param {HTMLElement} racineBloc
 * @param {string} phrase
 * @param {() => void} ouvrir
 */
export function renderBlocCible(racineBloc, phrase, ouvrir) {
  racineBloc.replaceChildren(
    el('small', { class: 'cible-phrase', text: phrase }),
    el('button', { class: 'appel', type: 'button', text: 'Choisir la cible', onClick: ouvrir }));
}
