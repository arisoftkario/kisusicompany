// Chargement de Firebase (depuis le CDN de Google) et petits utilitaires
// partagés par la section « Actualités » et l'espace administrateur.
import { firebaseConfig, FIREBASE_VERSION } from './firebase-config.js';

const cdn = (module) =>
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${module}.js`;

let ready;

/// Initialise Firebase une seule fois et renvoie
/// { auth, db, A (fonctions Auth), F (fonctions Firestore) }.
export function firebase() {
  ready ??= (async () => {
    const [app, A, F] = await Promise.all([
      import(cdn('app')),
      import(cdn('auth')),
      import(cdn('firestore')),
    ]);
    const instance = app.initializeApp(firebaseConfig);
    return { auth: A.getAuth(instance), db: F.getFirestore(instance), A, F, instance };
  })();
  return ready;
}

/// Visiteur connecté (connexion anonyme automatique, sans compte).
export async function signedInUser({ auth, A }) {
  await auth.authStateReady();
  return auth.currentUser ?? (await A.signInAnonymously(auth)).user;
}

/// Module Firebase Cloud Messaging (notifications), chargé à la demande.
export const loadMessaging = () => import(cdn('messaging'));

export const PAGE_SIZE = 9;

export function usd(value) {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} $`;
}

export function dateFr(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/// Crée un élément : el('p', { class: 'x', text: '...' }, enfant1, enfant2).
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

/// Icône du sprite SVG de la page (#i-...).
export function icon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}
