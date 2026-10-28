// Espace administrateur : connexion, publications (marketing pour les
// « Actualités », produits en vente pour le « Catalogue ») et suivi des
// réservations en ligne.
import { isConfigured } from './firebase-config.js';
import { firebase, usd, dateFr, el } from './firebase.js';

const $ = (selector) => document.querySelector(selector);

/// Plus grand côté des photos envoyées (en pixels) : assez pour un écran,
/// assez léger pour les réseaux mobiles.
const MAX_SIDE = 1600;
const MAX_PHOTOS = 6;
const MAX_VIDEO_MB = 100;

/// Envoi des vidéos directement vers Vercel Blob (trop lourdes pour /api/media).
const BLOB_CLIENT = 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.2/client/+esm';

/// Collection Firestore de chaque type de publication.
const COLLECTION = { contenu: 'posts', produit: 'products' };

let fb;
let editing = null; // { id, type, media } pendant une modification
let media = []; // [{ url } déjà en ligne | { file }, kind: 'image' | 'video', preview }]
let items = []; // toutes les publications chargées
let tab = 'tout';

if (isConfigured) start();
else $('#setup-msg').hidden = false;

async function start() {
  fb = await firebase();
  const { auth, A } = fb;

  A.onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) return showLogin();
    if (await isAdmin(user)) return showDashboard(user);
    await A.signOut(auth);
    showLogin("Ce compte n'est pas administrateur.", 'err');
  });

  $('#login-form').addEventListener('submit', login);
  $('#reset-password').addEventListener('click', resetPassword);
  $('#logout').addEventListener('click', () => A.signOut(auth));
  $('#post-form').addEventListener('submit', savePost);
  $('#post-form').addEventListener('input', (e) => e.target.classList.remove('is-invalid'));
  $('#post-cancel').addEventListener('click', () => resetForm());
  document.querySelectorAll('[name=type]').forEach((r) => r.addEventListener('change', () => applyType(currentType())));
  $('#add-photos').addEventListener('change', (e) => {
    addPhotos([...e.target.files]);
    e.target.value = '';
  });
  $('#add-video').addEventListener('change', (e) => {
    if (e.target.files[0]) addVideo(e.target.files[0]);
    e.target.value = '';
  });
  document.querySelectorAll('#list-tabs [data-tab]').forEach((chip) => chip.addEventListener('click', () => {
    tab = chip.dataset.tab;
    document.querySelectorAll('#list-tabs [data-tab]').forEach((c) => {
      c.classList.toggle('is-active', c === chip);
      c.setAttribute('aria-pressed', String(c === chip));
    });
    renderList();
  }));
  applyType('contenu');
}

async function isAdmin(user) {
  try {
    return (await fb.F.getDoc(fb.F.doc(fb.db, 'admins', user.uid))).exists();
  } catch {
    return false;
  }
}

function message(target, text, kind = '') {
  const node = $(target);
  node.textContent = text;
  node.className = `admin__msg${kind ? ` admin__msg--${kind}` : ''}`;
  node.hidden = !text;
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

function showLogin(text = '', kind = '') {
  $('#dashboard').hidden = true;
  $('#admin-user').hidden = true;
  $('#login-form').hidden = false;
  message('#login-msg', text, kind);
}

async function login(e) {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  message('#login-msg', '');
  try {
    await fb.A.signInWithEmailAndPassword(fb.auth, $('#login-email').value.trim(), $('#login-password').value);
  } catch (err) {
    const known = {
      'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
      'auth/invalid-email': 'Adresse e-mail invalide.',
      'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
    };
    message('#login-msg', known[err.code] ?? 'Connexion impossible. Vérifiez votre connexion internet.', 'err');
  }
  button.disabled = false;
}

async function resetPassword() {
  const email = $('#login-email').value.trim();
  if (!email) return message('#login-msg', "Saisissez d'abord votre e-mail.", 'err');
  try {
    await fb.A.sendPasswordResetEmail(fb.auth, email);
    message('#login-msg', 'Un e-mail de réinitialisation vous a été envoyé.', 'ok');
  } catch {
    message('#login-msg', "Impossible d'envoyer l'e-mail de réinitialisation.", 'err');
  }
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

function showDashboard(user) {
  $('#login-form').hidden = true;
  $('#dashboard').hidden = false;
  $('#admin-user').hidden = false;
  $('#admin-email').textContent = user.email;
  loadPosts();
  loadOrders();
}

async function loadPosts() {
  const { db, F } = fb;
  const count = (ref) => F.getCountFromServer(ref).then((c) => c.data().count).catch(() => 0);
  const latest = (type) => F.getDocs(F.query(F.collection(db, COLLECTION[type]), F.orderBy('createdAt', 'desc'), F.limit(100)))
    .then((snap) => snap.docs.map((d) => ({ id: d.id, type, ...d.data() })));
  try {
    const [posts, products, followers] = await Promise.all([
      latest('contenu'), latest('produit'), count(F.collection(db, 'follows')),
    ]);
    const likes = await Promise.all(posts.map((p) => count(F.collection(db, 'posts', p.id, 'likes'))));
    posts.forEach((p, i) => (p.likes = likes[i]));

    $('#stat-posts').textContent = posts.length;
    $('#stat-products').textContent = products.filter((p) => !p.sold).length;
    $('#stat-likes').textContent = likes.reduce((a, b) => a + b, 0);
    $('#stat-followers').textContent = followers;
    const time = (p) => p.createdAt?.toMillis?.() ?? Date.now();
    items = [...posts, ...products].sort((a, b) => time(b) - time(a));
    renderList();
  } catch (err) {
    console.error(err);
    $('#post-list').replaceChildren(el('p', { class: 'admin__empty', text: 'Impossible de charger les publications.' }));
  }
}

function renderList() {
  const shown = items.filter((p) => tab === 'tout' || p.type === tab);
  if (!shown.length) {
    $('#post-list').replaceChildren(el('p', { class: 'admin__empty', text: 'Aucune publication. Créez la première avec le formulaire.' }));
    return;
  }
  $('#post-list').replaceChildren(...shown.map((p) => {
    const photo = (p.media ?? []).find((m) => m.kind === 'image');
    const hasVideo = (p.media ?? []).some((m) => m.kind === 'video');
    const details = p.type === 'produit'
      ? [dateFr(p.createdAt), usd(p.price), p.sold && 'VENDU']
      : [dateFr(p.createdAt), hasVideo && 'vidéo', `${p.likes} j'aime`];
    const editBtn = el('button', { type: 'button', class: 'btn btn--outline btn--sm', text: 'Modifier' });
    const deleteBtn = el('button', { type: 'button', class: 'btn btn--sm admin__danger', text: 'Supprimer' });
    editBtn.addEventListener('click', () => editPost(p));
    deleteBtn.addEventListener('click', () => deletePost(p, deleteBtn));
    return el('article', { class: 'admin-post' },
      photo
        ? el('img', { src: photo.url, alt: '', loading: 'lazy' })
        : el('span', { class: 'admin-post__noimg', text: hasVideo ? 'Vidéo' : 'Sans photo' }),
      el('div', {},
        el('span', { class: `admin-post__type is-${p.type}`, text: p.type === 'produit' ? 'Produit' : 'Marketing' }),
        el('h3', { text: p.title }),
        el('p', { text: details.filter(Boolean).join(' · ') })),
      el('div', { class: 'admin-post__actions' }, editBtn, deleteBtn));
  }));
}

// ---------------------------------------------------------------------------
// Réservations en ligne
// ---------------------------------------------------------------------------

const STATUSES = {
  nouvelle: 'Nouvelle',
  confirmee: 'Confirmée',
  acompte: 'Acompte payé',
  livree: 'Livrée',
  annulee: 'Annulée',
};
const MODES = { comptant: 'Comptant', credit: 'À crédit' };
const PAYMENTS = { 'mobile-money': 'Mobile Money', agence: "À l'agence" };

/// Numéro au format WhatsApp : 0997… → 243997…
const waNumber = (phone) => phone.replace(/\D/g, '').replace(/^0/, '243');

async function loadOrders() {
  const { db, F } = fb;
  try {
    const snap = await F.getDocs(F.query(F.collection(db, 'orders'), F.orderBy('createdAt', 'desc'), F.limit(100)));
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    $('#stat-orders').textContent = orders.filter((o) => o.status === 'nouvelle').length;
    renderOrders(orders);
  } catch (err) {
    console.error(err);
    $('#order-list').replaceChildren(el('p', { class: 'admin__empty', text: 'Impossible de charger les réservations.' }));
  }
}

function renderOrders(orders) {
  if (!orders.length) {
    $('#order-list').replaceChildren(el('p', { class: 'admin__empty', text: 'Aucune réservation pour le moment.' }));
    return;
  }
  $('#order-list').replaceChildren(...orders.map((o) => {
    const status = el('select', { class: 'admin-order__status', 'aria-label': `Statut de la réservation de ${o.name}` },
      ...Object.entries(STATUSES).map(([value, label]) =>
        el('option', { value, text: label, selected: value === o.status })));
    status.addEventListener('change', () => setStatus(o, status));
    const greeting = `Bonjour ${o.name}, ici KISUSI COMPANY à propos de votre réservation « ${o.vehicle} ».`;
    return el('article', { class: `admin-order is-${o.status}` },
      el('div', {},
        el('h3', { text: `${o.vehicle} — n° ${o.id.slice(0, 6).toUpperCase()}` }),
        el('p', { text: [o.name, o.phone, o.city, dateFr(o.createdAt)].join(' · ') }),
        el('p', { text: `Acompte ${usd(o.deposit)} sur ${usd(o.price)} · ${MODES[o.mode] ?? o.mode} · ${PAYMENTS[o.payment] ?? o.payment}` }),
        o.note && el('p', { class: 'admin-order__note', text: `« ${o.note} »` })),
      el('div', { class: 'admin-order__actions' },
        status,
        el('a', { class: 'btn btn--outline btn--sm', href: `tel:${o.phone.replace(/[^\d+]/g, '')}`, text: 'Appeler' }),
        el('a', {
          class: 'btn btn--sm share-list__wa', target: '_blank', rel: 'noopener', text: 'WhatsApp',
          href: `https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(greeting)}`,
        })));
  }));
}

async function setStatus(order, select) {
  const { db, F } = fb;
  select.disabled = true;
  try {
    await F.updateDoc(F.doc(db, 'orders', order.id), { status: select.value, updatedAt: F.serverTimestamp() });
    order.status = select.value;
    select.closest('.admin-order').className = `admin-order is-${order.status}`;
  } catch (err) {
    console.error(err);
    select.value = order.status;
    alert(`Statut non enregistré : ${err.message}`);
  }
  select.disabled = false;
  const pending = document.querySelectorAll('.admin-order.is-nouvelle').length;
  $('#stat-orders').textContent = pending;
}


// ---------------------------------------------------------------------------
// Formulaire : publier / modifier
// ---------------------------------------------------------------------------

const currentType = () => document.querySelector('[name=type]:checked').value;

/// Affiche les champs du type choisi (marketing ou produit).
function applyType(type) {
  const product = type === 'produit';
  document.querySelectorAll('#post-form [data-for]').forEach((node) => (node.hidden = node.dataset.for !== type));
  $('#title-label').textContent = product ? 'Nom du véhicule *' : 'Titre *';
  $('#post-title').placeholder = product ? 'Ex. : Toyota RAV4 2019' : 'Ex. : Remise des clés à M. Kambale, Beni';
  $('#text-label').textContent = product ? 'Description (facultatif)' : 'Texte *';
  $('#post-text').placeholder = product
    ? 'État, options, conditions de paiement, lieu…'
    : 'Racontez la remise, présentez une nouveauté ou une offre…';
  $('#media-hint').textContent = product
    ? `(1 à ${MAX_PHOTOS}, la première est la photo principale)`
    : `(jusqu'à ${MAX_PHOTOS}, ou une vidéo de ${MAX_VIDEO_MB} Mo maximum)`;
  // Les produits n'ont que des photos.
  if (product) media = media.filter((m) => m.kind === 'image');
  renderMedia();
}

function renderMedia() {
  $('#media-list').replaceChildren(...media.map((m, i) => {
    const remove = el('button', { type: 'button', class: 'admin__media-remove', 'aria-label': 'Retirer', text: '×' });
    remove.addEventListener('click', () => {
      media.splice(i, 1);
      renderMedia();
    });
    return el('div', { class: 'admin__media-item' },
      m.kind === 'video'
        ? el('video', { src: m.preview, muted: true, playsinline: true, preload: 'metadata' })
        : el('img', { src: m.preview, alt: '' }),
      m.kind === 'video' && el('span', { class: 'admin__media-tag', text: 'Vidéo' }),
      remove);
  }));
}

function addPhotos(files) {
  const room = MAX_PHOTOS - media.filter((m) => m.kind === 'image').length;
  files.filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room)).forEach((file) => {
    media.push({ file, kind: 'image', preview: URL.createObjectURL(file) });
  });
  if (files.length > room) message('#form-msg', `${MAX_PHOTOS} photos maximum par publication.`, 'err');
  renderMedia();
}

function addVideo(file) {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    return message('#form-msg', `Vidéo trop lourde (${MAX_VIDEO_MB} Mo maximum). Raccourcissez-la ou envoyez-la en qualité 720p.`, 'err');
  }
  // Une seule vidéo par publication : la nouvelle remplace l'ancienne.
  media = media.filter((m) => m.kind !== 'video');
  media.unshift({ file, kind: 'video', preview: URL.createObjectURL(file) });
  message('#form-msg', '');
  renderMedia();
}

function resetForm() {
  editing = null;
  media = [];
  $('#post-form').reset();
  document.querySelectorAll('[name=type]').forEach((r) => (r.disabled = false));
  applyType('contenu');
  $('#form-title').textContent = 'Nouvelle publication';
  $('#post-submit').textContent = 'Publier';
  $('#post-cancel').hidden = true;
  $('#notify-row').hidden = false;
}

function editPost(p) {
  editing = { id: p.id, type: p.type, media: p.media ?? [] };
  document.querySelectorAll('[name=type]').forEach((r) => {
    r.checked = r.value === p.type;
    r.disabled = r.value !== p.type; // le type ne change pas après publication
  });
  media = (p.media ?? []).map((m) => ({ ...m, preview: m.url }));
  applyType(p.type);
  $('#post-title').value = p.title;
  $('#post-text').value = p.text ?? '';
  if (p.type === 'produit') {
    $('#post-category').value = p.category;
    $('#post-price').value = p.price ?? '';
    $('#post-year').value = p.year ?? '';
    $('#post-km').value = p.km ?? '';
    $('#post-fuel').value = p.fuel || 'Essence';
    $('#post-credit').checked = p.credit !== false;
    $('#post-japan').checked = p.fromJapan === true;
    $('#post-sold').checked = p.sold === true;
  }
  $('#form-title').textContent = p.type === 'produit' ? 'Modifier le produit' : 'Modifier la publication';
  $('#post-submit').textContent = 'Enregistrer les modifications';
  $('#post-cancel').hidden = false;
  $('#notify-row').hidden = true;
  message('#form-msg', '');
  $('#post-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/// Réduit la photo et la convertit en WebP (JPEG si le navigateur ne sait pas).
async function compress(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const toBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob('image/webp', 0.82);
  return webp?.type === 'image/webp' ? webp : toBlob('image/jpeg', 0.85);
}

/// Appel aux fonctions serveur (dossier api/) avec le jeton de l'administrateur.
async function api(path, options = {}) {
  const token = await fb.auth.currentUser.getIdToken();
  const res = await fetch(path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `erreur ${res.status}`);
  return data;
}

async function uploadPhoto(file) {
  const blob = await compress(file);
  return (await api('/api/media', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob })).url;
}

async function uploadVideo(file, progress) {
  const { upload } = await import(BLOB_CLIENT);
  const token = await fb.auth.currentUser.getIdToken();
  const ext = { 'video/webm': 'webm', 'video/quicktime': 'mov' }[file.type] ?? 'mp4';
  const blob = await upload(`actus/videos/${Date.now()}.${ext}`, file, {
    access: 'public',
    handleUploadUrl: '/api/media',
    headers: { Authorization: `Bearer ${token}` },
    contentType: file.type || 'video/mp4',
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => progress(Math.round(percentage)),
  });
  return blob.url;
}

function removeMedia(url) {
  return api(`/api/media?url=${encodeURIComponent(url)}`, { method: 'DELETE' }).catch(console.error);
}

const numberOrNull = (value) => (value.trim() === '' ? null : Number(value));

async function savePost(e) {
  e.preventDefault();
  const type = currentType();
  const product = type === 'produit';
  const title = $('#post-title').value.trim();
  const text = $('#post-text').value.trim();
  const price = numberOrNull($('#post-price').value);
  const photos = media.filter((m) => m.kind === 'image').length;

  const errors = [];
  if (!title) errors.push(product ? 'le nom du véhicule' : 'le titre');
  if (!product && !text) errors.push('le texte');
  if (product && !(price > 0)) errors.push('le prix');
  if (product && !photos) errors.push('au moins une photo');
  $('#post-title').classList.toggle('is-invalid', !title);
  $('#post-text').classList.toggle('is-invalid', !product && !text);
  $('#post-price').classList.toggle('is-invalid', product && !(price > 0));
  if (errors.length) return message('#form-msg', `À compléter : ${errors.join(', ')}.`, 'err');

  const submit = $('#post-submit');
  const label = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Enregistrement…';
  const uploaded = [];

  try {
    const { db, F } = fb;
    // Envoi des nouvelles photos et de la vidéo, dans l'ordre affiché.
    const total = media.filter((m) => m.file).length;
    let done = 0;
    for (const m of media) {
      if (!m.file) continue;
      done += 1;
      const step = total > 1 ? ` ${done}/${total}` : '';
      if (m.kind === 'video') {
        m.url = await uploadVideo(m.file, (pct) => message('#form-msg', `Envoi de la vidéo… ${pct} %`));
      } else {
        message('#form-msg', `Envoi de la photo${step}…`);
        m.url = await uploadPhoto(m.file);
      }
      uploaded.push(m.url);
    }

    const data = {
      title,
      text,
      media: media.map(({ url, kind }) => ({ url, kind })),
      updatedAt: F.serverTimestamp(),
    };
    if (product) {
      Object.assign(data, {
        category: $('#post-category').value,
        price,
        year: numberOrNull($('#post-year').value),
        km: numberOrNull($('#post-km').value),
        fuel: $('#post-fuel').value,
        credit: $('#post-credit').checked,
        fromJapan: $('#post-japan').checked,
        sold: $('#post-sold').checked,
      });
    }
    const collection = COLLECTION[type];

    if (editing) {
      await F.updateDoc(F.doc(db, collection, editing.id), data);
      const kept = new Set(data.media.map((m) => m.url));
      editing.media.filter((m) => !kept.has(m.url)).forEach((m) => removeMedia(m.url));
      resetForm();
      message('#form-msg', 'Modifications enregistrées ✓', 'ok');
    } else {
      const notify = $('#post-notify').checked;
      const ref = await F.addDoc(F.collection(db, collection), { ...data, createdAt: F.serverTimestamp() });
      let msg = product ? 'Produit en ligne dans le catalogue ✓' : 'Publication en ligne ✓';
      if (notify) {
        try {
          const r = await api('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: ref.id, collection }),
          });
          msg += ` Notification envoyée à ${r.sent} appareil${r.sent > 1 ? 's' : ''}.`;
        } catch (err) {
          msg += ` Notification non envoyée (${err.message}).`;
        }
      }
      resetForm();
      message('#form-msg', msg, 'ok');
    }
    await loadPosts();
  } catch (err) {
    console.error(err);
    // Fichiers déjà envoyés supprimés : ils repartiront au prochain essai.
    uploaded.forEach(removeMedia);
    media.forEach((m) => {
      if (m.file) delete m.url;
    });
    message('#form-msg', `Échec de l'enregistrement : ${err.message}`, 'err');
  }
  submit.disabled = false;
  if (submit.textContent === 'Enregistrement…') submit.textContent = label;
}

async function deletePost(p, button) {
  if (!confirm(`Supprimer définitivement « ${p.title} » ?`)) return;
  const { db, F } = fb;
  button.disabled = true;
  try {
    if (p.type === 'contenu') {
      // Les « j'aime » sont stockés sous la publication : on les supprime d'abord.
      const likes = await F.getDocs(F.collection(db, 'posts', p.id, 'likes'));
      for (let i = 0; i < likes.docs.length; i += 450) {
        const batch = F.writeBatch(db);
        likes.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await F.deleteDoc(F.doc(db, COLLECTION[p.type], p.id));
    (p.media ?? []).forEach((m) => removeMedia(m.url));
    if (editing?.id === p.id) resetForm();
    message('#form-msg', 'Publication supprimée.', 'ok');
    await loadPosts();
  } catch (err) {
    console.error(err);
    button.disabled = false;
    message('#form-msg', `Suppression impossible : ${err.message}`, 'err');
  }
}
