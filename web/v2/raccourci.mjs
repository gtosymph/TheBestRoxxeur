/**
 * Un raccourci clavier, ecrit comme la machine le dit.
 *
 * « ⌘K » sur un Mac, « Ctrl K » ailleurs : montrer le mauvais signe apprend un
 * geste qui ne marche pas.
 *
 * @param {string} touche La lettre, en capitale.
 * @param {string} [plateforme] Le nom de la plateforme ; celle du navigateur par defaut.
 */
export function raccourci(touche, plateforme = globalThis.navigator?.platform
  || globalThis.navigator?.userAgent || '') {
  return /Mac|iPhone|iPad/i.test(plateforme) ? `⌘${touche}` : `Ctrl ${touche}`;
}
