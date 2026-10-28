// Photos des publications, stockées dans Vercel Blob.
// POST   /api/media           corps = image (WebP/JPEG/PNG) → { url }
// DELETE /api/media?url=...   supprime une photo devenue inutile
import { del, put } from '@vercel/blob';
import { HttpError, handle, requireAdmin } from '../server/firebase-admin.js';

const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_BYTES = 4 * 1024 * 1024; // limite des fonctions Vercel : 4,5 Mo

export function POST(request) {
  return handle(async () => {
    await requireAdmin(request);
    const type = (request.headers.get('content-type') ?? '').split(';')[0];
    const ext = TYPES[type];
    if (!ext) throw new HttpError(415, 'Format de photo non accepté');
    const body = Buffer.from(await request.arrayBuffer());
    if (!body.length) throw new HttpError(400, 'Photo vide');
    if (body.length > MAX_BYTES) throw new HttpError(413, 'Photo trop lourde (4 Mo maximum)');

    const blob = await put(`actus/${Date.now()}.${ext}`, body, {
      access: 'public',
      contentType: type,
      addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return { url: blob.url };
  });
}

export function DELETE(request) {
  return handle(async () => {
    await requireAdmin(request);
    const url = new URL(request.url).searchParams.get('url') ?? '';
    // On ne supprime que des photos de notre stockage Vercel Blob.
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/actus\//i.test(url)) {
      throw new HttpError(400, 'Adresse de photo invalide');
    }
    await del(url);
    return { ok: true };
  });
}
