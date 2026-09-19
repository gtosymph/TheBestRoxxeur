/**
 * Ce qu'une nouvelle ingestion change au catalogue.
 *
 * Le rafraichissement automatique des donnees ouvre une PR : son corps doit
 * dire ce qui bouge, sinon la fusion se fait a l'aveugle. Un « diff » de JSON
 * ne le dit pas — trois mille lignes changent quand une seule cle se deplace.
 * Ici, une entree est reconnue par son `id`, et comparee par son contenu,
 * quel que soit l'ordre des cles ou des entrees.
 */

/** Forme canonique d'une entree : memes cles, meme ordre, meme texte. */
function canon(valeur) {
  if (Array.isArray(valeur)) return `[${valeur.map(canon).join(',')}]`;
  if (valeur && typeof valeur === 'object') {
    const cles = Object.keys(valeur).sort();
    return `{${cles.map((c) => `${JSON.stringify(c)}:${canon(valeur[c])}`).join(',')}}`;
  }
  return JSON.stringify(valeur);
}

function parId(entrees, nom) {
  if (!Array.isArray(entrees)) throw new Error(`${nom} doit etre un tableau d'entrees.`);
  return new Map(entrees.map((e) => [e?.id, e]));
}

/**
 * Compare deux tableaux d'entrees identifiees par `id`.
 *
 * @param {{id: any}[]} avant
 * @param {{id: any}[]} apres
 * @returns {{ajoutes: any[], enleves: any[], modifies: any[], inchanges: number}}
 */
export function comparer(avant, apres) {
  const anciens = parId(avant, 'avant');
  const nouveaux = parId(apres, 'apres');

  const ajoutes = [...nouveaux.values()].filter((e) => !anciens.has(e.id));
  const enleves = [...anciens.values()].filter((e) => !nouveaux.has(e.id));
  const communs = [...nouveaux.values()].filter((e) => anciens.has(e.id));
  const modifies = communs.filter((e) => canon(e) !== canon(anciens.get(e.id)));

  return { ajoutes, enleves, modifies, inchanges: communs.length - modifies.length };
}

/** Quelques noms, puis « et N autres » : une PR se lit, elle ne se deroule pas. */
function nommer(entrees, maxNoms) {
  const noms = entrees.slice(0, maxNoms).map((e) => e.fr ?? e.nom ?? e.name ?? `#${e.id}`);
  const reste = entrees.length - noms.length;
  return noms.join(', ') + (reste > 0 ? ` et ${reste} autres` : '');
}

/**
 * Le corps de la PR, en Markdown.
 *
 * @param {Record<string, ReturnType<typeof comparer>>} parFichier Une entree
 *   par fichier compare, sous le nom montre au lecteur.
 * @param {{maxNoms?: number}} [choix]
 */
export function resumeMarkdown(parFichier, { maxNoms = 12 } = {}) {
  const lignes = [];
  for (const [nom, d] of Object.entries(parFichier)) {
    const total = d.ajoutes.length + d.enleves.length + d.modifies.length;
    if (total === 0) { lignes.push(`- ${nom} : aucun changement (${d.inchanges} entrees).`); continue; }
    lignes.push(`- ${nom} : ${d.ajoutes.length} ajoutes, ${d.enleves.length} enleves, `
      + `${d.modifies.length} modifies, ${d.inchanges} inchanges.`);
    if (d.ajoutes.length) lignes.push(`  - ajoutes : ${nommer(d.ajoutes, maxNoms)}`);
    if (d.enleves.length) lignes.push(`  - enleves : ${nommer(d.enleves, maxNoms)}`);
    if (d.modifies.length) lignes.push(`  - modifies : ${nommer(d.modifies, maxNoms)}`);
  }
  return lignes.join('\n');
}
