// Accès administrateur à Firebase pour les fonctions Vercel (dossier api/).
// Nécessite la variable d'environnement FIREBASE_SERVICE_ACCOUNT (voir FIREBASE.md).
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new HttpError(500, 'FIREBASE_SERVICE_ACCOUNT manquant sur Vercel');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

export const db = () => getFirestore(app());
export const messaging = () => getMessaging(app());

/// Vérifie que la requête vient d'un administrateur connecté (document admins/{uid}).
export async function requireAdmin(request) {
  const match = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '');
  if (!match) throw new HttpError(401, 'Connexion requise');
  let uid;
  try {
    ({ uid } = await getAuth(app()).verifyIdToken(match[1]));
  } catch {
    throw new HttpError(401, 'Session expirée, reconnectez-vous');
  }
  const admin = await db().doc(`admins/${uid}`).get();
  if (!admin.exists) throw new HttpError(403, 'Accès réservé aux administrateurs');
  return uid;
}

/// Exécute une fonction et transforme ses erreurs en réponse JSON.
export async function handle(fn) {
  try {
    return Response.json(await fn());
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    return Response.json({ error: err.message || 'Erreur serveur' }, { status });
  }
}
