/**
 * Ouvre l'application dans un vrai navigateur et verifie qu'elle vit.
 *
 * Les tests unitaires couvrent le moteur et les decisions des vues, mais
 * aucun n'ouvrait la page : une faute d'import dans app.mjs laissait passer
 * la CI et publiait un ecran blanc. Ce banc lance le serveur local, pilote
 * Chrome sans fenetre par son protocole de debogage, et refuse la moindre
 * erreur de la console.
 *
 * Le parcours est celui d'un nouveau joueur : l'accueil montre les classes,
 * un clic sur une classe ouvre l'atelier, et la recherche demarre.
 *
 * Le projet reste sans dependance : Node 22 porte deja un client WebSocket,
 * et le protocole de Chrome n'en demande pas plus.
 *
 *   npm run smoke
 *   CHROME=/chemin/vers/chrome npm run smoke
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT_SITE = 4199;
const PORT_DEBOGAGE = 9333;
const ADRESSE = `http://127.0.0.1:${PORT_SITE}/web/v2/index.html?test=smoke`;
/** Le temps laisse a chaque etape avant de la declarer en panne. */
const DELAI_MS = 30_000;
/** La recherche tourne ce temps-la avant le releve final des erreurs. */
const DUREE_RECHERCHE_MS = 3_000;

/**
 * Les services tiers dont les erreurs ne disent rien de l'application.
 *
 * La mesure d'audience de Cloudflare n'accepte que le vrai domaine du site :
 * depuis le serveur local, son envoi echoue toujours.
 */
const TIERS_IGNORES = Object.freeze(['cloudflareinsights.com']);

const dormir = (ms) => new Promise((suite) => { setTimeout(suite, ms); });

/** Le premier Chrome trouve : la variable CHROME, puis les chemins usuels. */
function trouverChrome() {
  const candidats = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const trouve = candidats.find((chemin) => existsSync(chemin));
  if (!trouve) throw new Error(`Aucun Chrome trouve. Essayes : ${candidats.join(', ')}`);
  return trouve;
}

/** Repete `essai` jusqu'a ce qu'il rende une valeur vraie, ou echoue au delai. */
async function attendre(nom, essai) {
  const limite = Date.now() + DELAI_MS;
  while (Date.now() < limite) {
    try {
      const valeur = await essai();
      if (valeur) return valeur;
    } catch { /* pas encore pret */ }
    await dormir(250);
  }
  throw new Error(`Delai depasse : ${nom}.`);
}

/** Une session sur le protocole de Chrome : des commandes, et des evenements. */
function ouvrirSession(adresseWs, surEvenement) {
  const socket = new WebSocket(adresseWs);
  let prochain = 1;
  const enAttente = new Map();

  socket.addEventListener('message', (ev) => {
    const message = JSON.parse(ev.data);
    if (message.id && enAttente.has(message.id)) {
      const { resoudre, rejeter } = enAttente.get(message.id);
      enAttente.delete(message.id);
      if (message.error) rejeter(new Error(message.error.message));
      else resoudre(message.result);
    } else if (message.method) {
      surEvenement(message.method, message.params);
    }
  });

  const pret = new Promise((resoudre, rejeter) => {
    socket.addEventListener('open', resoudre, { once: true });
    socket.addEventListener('error', () => rejeter(new Error('Connexion a Chrome impossible.')), { once: true });
  });

  const envoyer = (method, params = {}) => new Promise((resoudre, rejeter) => {
    const id = prochain;
    prochain += 1;
    enAttente.set(id, { resoudre, rejeter });
    socket.send(JSON.stringify({ id, method, params }));
  });

  /** Evalue une expression dans la page et rend sa valeur. */
  const evaluer = async (expression) => {
    const { result, exceptionDetails } = await envoyer('Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  };

  return { pret, envoyer, evaluer, fermer: () => socket.close() };
}

/** Transforme un evenement de la console en ligne d'erreur, ou null. */
function erreurDe(method, params) {
  if (method === 'Runtime.exceptionThrown') {
    const d = params.exceptionDetails;
    return `Exception : ${d.exception?.description ?? d.text}`;
  }
  if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
    return `console.error : ${params.args.map((a) => a.value ?? a.description).join(' ')}`;
  }
  if (method === 'Log.entryAdded' && params.entry.level === 'error') {
    return `${params.entry.source} : ${params.entry.text} ${params.entry.url ?? ''}`.trim();
  }
  return null;
}

async function main() {
  const erreurs = [];
  const profil = await mkdtemp(join(tmpdir(), 'copyroxx-smoke-'));
  const serveur = spawn(process.execPath, ['scripts/serve.mjs'], {
    env: { ...process.env, PORT: String(PORT_SITE), NODE_OPTIONS: '' }, stdio: 'ignore',
  });
  const chrome = spawn(trouverChrome(), [
    '--headless=new', `--remote-debugging-port=${PORT_DEBOGAGE}`, `--user-data-dir=${profil}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1400,900', 'about:blank',
  ], { stdio: 'ignore' });

  let session = null;
  try {
    await attendre('le serveur local', async () => (await fetch(ADRESSE)).ok);
    const cible = await attendre('Chrome', async () => {
      const liste = await (await fetch(`http://127.0.0.1:${PORT_DEBOGAGE}/json/list`)).json();
      return liste.find((onglet) => onglet.type === 'page');
    });

    session = ouvrirSession(cible.webSocketDebuggerUrl, (method, params) => {
      const erreur = erreurDe(method, params);
      if (erreur && !TIERS_IGNORES.some((hote) => erreur.includes(hote))) erreurs.push(erreur);
    });
    await session.pret;
    await session.envoyer('Runtime.enable');
    await session.envoyer('Log.enable');
    await session.envoyer('Page.enable');
    await session.envoyer('Page.navigate', { url: ADRESSE });

    const classes = await attendre('les classes de l\'accueil', () => session.evaluer(
      "document.querySelectorAll('#classes button').length"));
    process.stdout.write(`Accueil : ${classes} classes.\n`);

    await session.evaluer("document.querySelector('#classes button').click()");
    await attendre('l\'atelier', () => session.evaluer("!document.getElementById('travail').hidden"));
    process.stdout.write('Atelier ouvert.\n');

    const compteur = await attendre('la recherche', () => session.evaluer(
      "/\\d/.test(document.getElementById('compteur-generations')?.textContent ?? '') "
      + "&& document.getElementById('compteur-generations').textContent"));
    process.stdout.write(`Recherche : ${compteur}.\n`);

    await dormir(DUREE_RECHERCHE_MS);
    const message = await session.evaluer("document.getElementById('message').className");
    if (/erreur/.test(message)) {
      erreurs.push(`Message d'erreur a l'ecran : ${await session.evaluer("document.getElementById('message').textContent")}`);
    }
  } catch (erreur) {
    erreurs.push(erreur.message);
  } finally {
    session?.fermer();
    chrome.kill();
    serveur.kill();
    await rm(profil, { recursive: true, force: true }).catch(() => {});
  }

  if (erreurs.length > 0) {
    process.stderr.write(`Smoke test en echec :\n${erreurs.map((e) => `  - ${e}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('Smoke test reussi : aucune erreur dans la console.\n');
}

main();
