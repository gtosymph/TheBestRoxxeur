/**
 * Les briques du rendu : creer un element, remplir un noeud, ecrire un
 * nombre, et la vignette d'un objet. Tous les panneaux s'en servent.
 */

/** Cree un element avec ses attributs et ses enfants. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export const fill = (root, ...children) => root.replaceChildren(...children.flat().filter(Boolean));
export const nombre = (v) => Math.round(v).toLocaleString('fr-FR');
/** Troncature vers le bas, comme les moyennes du jeu. */
export const entier = (v) => Math.floor(v).toLocaleString('fr-FR');

/** Classe de couleur selon le signe d'une valeur. */
export function ton(valeur) {
  if (valeur > 0) return 'pos';
  if (valeur < 0) return 'neg';
  return 'nul';
}

/** Construit la vignette d'un item. L'icone se charge a l'approche. */
export function vignette(item, extra = '') {
  return el('button', {
    class: `case-item ${extra}`.trim(),
    type: 'button',
    title: `${item.fr} — niveau ${item.level}${item.criteria ? `\nCondition : ${item.criteria}` : ''}`,
  }, item.img
    ? el('img', { 'data-src': item.img, alt: item.fr, decoding: 'async' })
    : el('span', { class: 'case-initiales', text: item.fr.slice(0, 2) }),
  // Le nom et le niveau ne se voient qu'en liste — sur telephone, ou il n'y
  // a pas de survol pour montrer l'infobulle. La grille les cache.
  el('span', { class: 'case-nom', text: item.fr }),
  el('span', { class: 'case-niveau n', text: `niv. ${item.level}` }));
}
