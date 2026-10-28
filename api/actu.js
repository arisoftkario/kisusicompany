// GET /actu/<id> (réécrit vers /api/actu?id=<id> par vercel.json)
// Page de partage d'une publication marketing ou d'un produit : WhatsApp et
// Facebook y lisent le titre, le texte et la photo pour l'aperçu, puis le
// visiteur est redirigé sur le site.
import { db } from '../server/firebase-admin.js';
import { productLine } from './notify.js';

const escape = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';

  let snap = null;
  let product = false;
  if (/^[A-Za-z0-9]{1,64}$/.test(id)) {
    try {
      snap = await db().doc(`posts/${id}`).get();
      if (!snap.exists) {
        snap = await db().doc(`products/${id}`).get();
        product = true;
      }
    } catch (err) {
      console.error(err);
    }
  }
  if (!snap?.exists) return Response.redirect(`${url.origin}/#actus`, 302);

  const post = snap.data();
  const target = product
    ? `/?produit=${encodeURIComponent(id)}#catalogue`
    : `/?actu=${encodeURIComponent(id)}#actus`;
  const text = product ? [productLine(snap), post.text].filter(Boolean).join(' — ') : post.text ?? '';
  const description = text.length > 200 ? `${text.slice(0, 197)}…` : text;
  const photo = (post.media ?? []).find((m) => m.kind === 'image');
  const image = photo?.url || `${url.origin}/images/og-image.jpg`;
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(post.title)} — KISUSI COMPANY</title>
<meta name="description" content="${escape(description)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="KISUSI COMPANY">
<meta property="og:title" content="${escape(post.title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="${escape(image)}">
<meta property="og:url" content="${escape(`${url.origin}/actu/${id}`)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${escape(url.origin + target)}">
<meta http-equiv="refresh" content="0; url=${escape(target)}">
</head>
<body>
<p><a href="${escape(target)}">Voir la publication sur le site KISUSI COMPANY</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
