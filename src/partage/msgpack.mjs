/**
 * Ecriture MessagePack, reduite a ce que le partage demande.
 *
 * Dofusbook lit ses liens dans ce format : le stuff voyage en MessagePack
 * passe en base64. Le projet n'ayant aucune dependance, l'ecriture tient ici ;
 * le passage en base64 vit a cote, dans `base64.mjs`, parce que nos propres
 * liens s'en servent aussi.
 *
 * L'ecriture ne connait que ce que nos liens portent : entiers positifs,
 * chaines courtes, tableaux, tables. Tout le reste leve, plutot que d'ecrire
 * des octets que personne ne relira.
 *
 * La lecture va un peu plus loin, parce qu'elle recoit des octets fabriques
 * par LEUR page, pas par la notre : nil, booleens, entiers negatifs et
 * chaines longues sont acceptes. Les flottants, les binaires et les
 * extensions ne le sont pas — leur format ne les emploie pas, et un type
 * inattendu vaut mieux dit que devine.
 */

/** Octets d'une valeur, en MessagePack. */
export function ecrire(valeur) {
  const octets = [];
  poser(valeur, octets);
  return Uint8Array.from(octets);
}

/** Ecrit un entier non signe, dans la plus petite forme qui le contient. */
function poserEntier(n, octets) {
  if (n <= 0x7f) { octets.push(n); return; }
  if (n <= 0xff) { octets.push(0xcc, n); return; }
  if (n <= 0xffff) { octets.push(0xcd, n >> 8, n & 0xff); return; }
  if (n <= 0xffffffff) {
    octets.push(0xce, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
    return;
  }
  throw new RangeError(`Entier trop grand pour ce format : ${n}`);
}

function poser(valeur, octets) {
  if (typeof valeur === 'number') {
    if (!Number.isInteger(valeur) || valeur < 0) {
      throw new TypeError(`Seuls les entiers positifs s'ecrivent ici : ${valeur}`);
    }
    poserEntier(valeur, octets);
    return;
  }

  if (typeof valeur === 'string') {
    const brut = new TextEncoder().encode(valeur);
    if (brut.length > 31) throw new RangeError('Chaine trop longue pour ce format.');
    octets.push(0xa0 | brut.length);
    octets.push(...brut);
    return;
  }

  if (Array.isArray(valeur)) {
    if (valeur.length < 16) octets.push(0x90 | valeur.length);
    else if (valeur.length <= 0xffff) octets.push(0xdc, valeur.length >> 8, valeur.length & 0xff);
    else throw new RangeError('Tableau trop long pour ce format.');
    for (const element of valeur) poser(element, octets);
    return;
  }

  if (valeur && typeof valeur === 'object') {
    const paires = Object.entries(valeur);
    if (paires.length < 16) octets.push(0x80 | paires.length);
    else if (paires.length <= 0xffff) octets.push(0xde, paires.length >> 8, paires.length & 0xff);
    else throw new RangeError('Table trop longue pour ce format.');
    for (const [cle, sous] of paires) { poser(cle, octets); poser(sous, octets); }
    return;
  }

  throw new TypeError(`Valeur que ce format ne sait pas ecrire : ${String(valeur)}`);
}

/**
 * Valeur portee par des octets MessagePack.
 *
 * @param {Uint8Array} octets
 * @returns {any}
 * @throws {RangeError} Octets tronques, ou octets en trop apres la valeur :
 *   un lien coupe par un client de discussion doit se dire.
 * @throws {TypeError} Type que ce lecteur ne connait pas.
 */
export function lire(octets) {
  const lecteur = { octets, position: 0 };
  const valeur = prendre(lecteur);
  if (lecteur.position !== octets.length) {
    throw new RangeError(`${octets.length - lecteur.position} octet(s) de trop apres la valeur.`);
  }
  return valeur;
}

/** Les `n` octets suivants, ou une erreur claire quand ils manquent. */
function tranche(lecteur, n) {
  if (lecteur.position + n > lecteur.octets.length) {
    throw new RangeError('Octets tronques : la valeur n\'est pas entiere.');
  }
  const debut = lecteur.position;
  lecteur.position += n;
  return lecteur.octets.subarray(debut, debut + n);
}

/** Entier non signe gros-boutiste sur `n` octets. */
function entier(lecteur, n) {
  return [...tranche(lecteur, n)].reduce((total, octet) => total * 256 + octet, 0);
}

function chaine(lecteur, n) {
  return new TextDecoder().decode(tranche(lecteur, n));
}

function tableau(lecteur, n) {
  const sortie = [];
  for (let i = 0; i < n; i += 1) sortie.push(prendre(lecteur));
  return sortie;
}

function table(lecteur, n) {
  const sortie = {};
  for (let i = 0; i < n; i += 1) {
    const cle = prendre(lecteur);
    sortie[String(cle)] = prendre(lecteur);
  }
  return sortie;
}

/** Les types a en-tete fixe, par premier octet. */
const FIXES = new Map([
  [0xc0, () => null], [0xc2, () => false], [0xc3, () => true],
  [0xcc, (l) => entier(l, 1)], [0xcd, (l) => entier(l, 2)], [0xce, (l) => entier(l, 4)],
  [0xd0, (l) => (entier(l, 1) << 24) >> 24], [0xd1, (l) => (entier(l, 2) << 16) >> 16],
  [0xd2, (l) => entier(l, 4) | 0],
  [0xd9, (l) => chaine(l, entier(l, 1))], [0xda, (l) => chaine(l, entier(l, 2))],
  [0xdc, (l) => tableau(l, entier(l, 2))], [0xde, (l) => table(l, entier(l, 2))],
]);

function prendre(lecteur) {
  const [tete] = tranche(lecteur, 1);
  if (tete <= 0x7f) return tete;
  if (tete >= 0xe0) return tete - 0x100;
  if ((tete & 0xe0) === 0xa0) return chaine(lecteur, tete & 0x1f);
  if ((tete & 0xf0) === 0x90) return tableau(lecteur, tete & 0x0f);
  if ((tete & 0xf0) === 0x80) return table(lecteur, tete & 0x0f);
  const fixe = FIXES.get(tete);
  if (!fixe) throw new TypeError(`Type MessagePack que ce lecteur ne connait pas : 0x${tete.toString(16)}`);
  return fixe(lecteur);
}
