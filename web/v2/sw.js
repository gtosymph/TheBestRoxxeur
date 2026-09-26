/*
 * Le service worker : l'outil s'ouvre aussi sans reseau.
 *
 * Tout le calcul se fait deja dans le navigateur ; seul le chargement des
 * fichiers demandait le reseau. Ce worker garde une copie de chaque fichier
 * du site qu'il voit passer, et la rend quand le reseau manque.
 *
 * Le reseau passe TOUJOURS en premier. Un worker qui servirait d'abord sa
 * copie montrerait l'ancienne version apres chaque mise en ligne, et un
 * catalogue d'objets perime donnerait des builds faux sans rien dire. La
 * copie ne sert donc qu'en secours.
 */
const CACHE = 'copyroxx-hors-ligne-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (ev) => {
  // Une ancienne version du cache ne doit pas survivre a un changement de nom.
  ev.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms
      .filter((nom) => nom.startsWith('copyroxx-') && nom !== CACHE)
      .map((nom) => caches.delete(nom)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (ev) => {
  const requete = ev.request;
  // Seuls les fichiers du site se gardent : ni les envois, ni les autres
  // domaines (les images de DofusDB, le lien de soutien).
  if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) return;
  ev.respondWith(reseauPuisCopie(requete, ev));
});

async function reseauPuisCopie(requete, ev) {
  const cache = await caches.open(CACHE);
  try {
    const reponse = await fetch(requete);
    if (reponse.ok) ev.waitUntil(cache.put(requete, reponse.clone()));
    return reponse;
  } catch (erreur) {
    // L'adresse de la page porte souvent ?test= ou #lien : la copie de la
    // page se trouve sans eux.
    const copie = await cache.match(requete, { ignoreSearch: requete.mode === 'navigate' });
    if (copie) return copie;
    throw erreur;
  }
}
