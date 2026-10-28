// POST /api/notify { postId } : envoie une notification à tous les abonnés
// pour une nouvelle publication (une seule fois par publication).
import { FieldValue } from 'firebase-admin/firestore';
import { HttpError, db, handle, messaging, requireAdmin } from '../server/firebase-admin.js';

// Jetons à oublier : appareil désinscrit ou application désinstallée.
const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export function POST(request) {
  return handle(async () => {
    await requireAdmin(request);
    const { postId } = await request.json().catch(() => ({}));
    if (typeof postId !== 'string' || !postId) throw new HttpError(400, 'postId manquant');

    const postRef = db().doc(`posts/${postId}`);
    const post = await postRef.get();
    if (!post.exists) throw new HttpError(404, 'Publication introuvable');
    if (post.get('notifiedAt')) return { sent: 0, already: true };

    const text = post.get('text') ?? '';
    const data = {
      title: post.get('title') ?? 'KISUSI COMPANY',
      body: text.length > 140 ? `${text.slice(0, 137)}…` : text,
      image: post.get('imageUrl') ?? '',
      url: `${new URL(request.url).origin}/?actu=${postId}#actus`,
      tag: `actu-${postId}`,
    };

    const tokens = (await db().collection('pushTokens').get()).docs
      .map((d) => ({ ref: d.ref, token: d.get('token') }))
      .filter((t) => typeof t.token === 'string' && t.token);

    let sent = 0;
    let removed = 0;
    // FCM accepte 500 destinataires par envoi.
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const res = await messaging().sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        data,
        webpush: { headers: { Urgency: 'high', TTL: String(60 * 60 * 24 * 3) } },
      });
      const cleanup = db().batch();
      res.responses.forEach((r, j) => {
        if (r.success) sent += 1;
        else if (DEAD_TOKEN.has(r.error?.code)) {
          cleanup.delete(chunk[j].ref);
          removed += 1;
        }
      });
      await cleanup.commit();
    }

    await postRef.update({ notifiedAt: FieldValue.serverTimestamp() });
    return { sent, removed, total: tokens.length };
  });
}
