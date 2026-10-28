// Espace administrateur : connexion, publication, modification et
// suppression des publicités affichées dans la section « Actualités ».
import { isConfigured } from './firebase-config.js';
import { firebase, usd, dateFr, el } from './firebase.js';

const $ = (selector) => document.querySelector(selector);

/// Plus grand côté des photos envoyées (en pixels) : assez pour un écran,
/// assez léger pour les réseaux mobiles.
const MAX_SIDE = 1600;

let fb;
let editing = null; // { id, imageUrl } pendant une modification
let image = { file: null, keep: '' }; // nouvelle photo, ou adresse de la photo conservée

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
  $('#post-cancel').addEventListener('click', () => resetForm());
  $('#post-image').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) setPreview(URL.createObjectURL(file), file);
  });
  $('#remove-image').addEventListener('click', () => setPreview('', null));
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
}

async function loadPosts() {
  const { db, F } = fb;
  const count = (ref) => F.getCountFromServer(ref).then((c) => c.data().count).catch(() => 0);
  try {
    const snap = await F.getDocs(F.query(F.collection(db, 'posts'), F.orderBy('createdAt', 'desc'), F.limit(100)));
    const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const [likes, followers] = await Promise.all([
      Promise.all(posts.map((p) => count(F.collection(db, 'posts', p.id, 'likes')))),
      count(F.collection(db, 'follows')),
    ]);
    posts.forEach((p, i) => (p.likes = likes[i]));

    $('#stat-posts').textContent = posts.length;
    $('#stat-likes').textContent = likes.reduce((a, b) => a + b, 0);
    $('#stat-followers').textContent = followers;
    renderList(posts);
  } catch (err) {
    console.error(err);
    $('#post-list').replaceChildren(el('p', { class: 'admin__empty', text: 'Impossible de charger les publications.' }));
  }
}

function renderList(posts) {
  if (!posts.length) {
    $('#post-list').replaceChildren(el('p', { class: 'admin__empty', text: 'Aucune publication. Créez la première avec le formulaire.' }));
    return;
  }
  $('#post-list').replaceChildren(...posts.map((p) => {
    const details = [dateFr(p.createdAt), p.price != null && usd(p.price), `${p.likes} j'aime`].filter(Boolean);
    const editBtn = el('button', { type: 'button', class: 'btn btn--outline btn--sm', text: 'Modifier' });
    const deleteBtn = el('button', { type: 'button', class: 'btn btn--sm admin__danger', text: 'Supprimer' });
    editBtn.addEventListener('click', () => editPost(p));
    deleteBtn.addEventListener('click', () => deletePost(p, deleteBtn));
    return el('article', { class: 'admin-post' },
      p.imageUrl ? el('img', { src: p.imageUrl, alt: '', loading: 'lazy' }) : el('span', { class: 'admin-post__noimg', text: 'Sans photo' }),
      el('div', {},
        el('h3', { text: p.title }),
        el('p', { text: details.join(' · ') })),
      el('div', { class: 'admin-post__actions' }, editBtn, deleteBtn));
  }));
}

// ---------------------------------------------------------------------------
// Formulaire : publier / modifier
// ---------------------------------------------------------------------------

function setPreview(url, file) {
  image = { file, keep: file ? '' : url };
  $('#post-preview').hidden = !url;
  $('#post-preview img').src = url;
  if (!file) $('#post-image').value = '';
}

function resetForm() {
  editing = null;
  $('#post-form').reset();
  setPreview('', null);
  $('#form-title').textContent = 'Nouvelle publication';
  $('#post-submit').textContent = 'Publier';
  $('#post-cancel').hidden = true;
  $('#notify-row').hidden = false;
}

function editPost(p) {
  editing = { id: p.id, imageUrl: p.imageUrl || '' };
  $('#post-title').value = p.title;
  $('#post-text').value = p.text;
  $('#post-price').value = p.price ?? '';
  setPreview(p.imageUrl || '', null);
  $('#form-title').textContent = 'Modifier la publication';
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

function removeMedia(url) {
  return api(`/api/media?url=${encodeURIComponent(url)}`, { method: 'DELETE' }).catch(console.error);
}

async function savePost(e) {
  e.preventDefault();
  const title = $('#post-title').value.trim();
  const text = $('#post-text').value.trim();
  const priceRaw = $('#post-price').value.trim();
  $('#post-title').classList.toggle('is-invalid', !title);
  $('#post-text').classList.toggle('is-invalid', !text);
  if (!title || !text) return message('#form-msg', 'Le titre et le texte sont obligatoires.', 'err');

  const submit = $('#post-submit');
  const label = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Enregistrement…';
  let uploaded = null;

  try {
    const { db, F } = fb;
    let imageUrl = image.keep;
    if (image.file) {
      message('#form-msg', 'Envoi de la photo…');
      const blob = await compress(image.file);
      uploaded = (await api('/api/media', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob })).url;
      imageUrl = uploaded;
    }
    const data = { title, text, price: priceRaw === '' ? null : Number(priceRaw), imageUrl, updatedAt: F.serverTimestamp() };

    if (editing) {
      await F.updateDoc(F.doc(db, 'posts', editing.id), data);
      if (editing.imageUrl && editing.imageUrl !== imageUrl) removeMedia(editing.imageUrl);
      resetForm();
      message('#form-msg', 'Publication modifiée ✓', 'ok');
    } else {
      const notify = $('#post-notify').checked;
      const ref = await F.addDoc(F.collection(db, 'posts'), { ...data, createdAt: F.serverTimestamp() });
      let done = 'Publication en ligne ✓';
      if (notify) {
        try {
          const r = await api('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: ref.id }),
          });
          done += ` Notification envoyée à ${r.sent} appareil${r.sent > 1 ? 's' : ''}.`;
        } catch (err) {
          done += ` Notification non envoyée (${err.message}).`;
        }
      }
      resetForm();
      message('#form-msg', done, 'ok');
    }
    await loadPosts();
  } catch (err) {
    console.error(err);
    if (uploaded) removeMedia(uploaded);
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
    // Les « j'aime » sont stockés sous la publication : on les supprime d'abord.
    const likes = await F.getDocs(F.collection(db, 'posts', p.id, 'likes'));
    for (let i = 0; i < likes.docs.length; i += 450) {
      const batch = F.writeBatch(db);
      likes.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await F.deleteDoc(F.doc(db, 'posts', p.id));
    if (p.imageUrl) removeMedia(p.imageUrl);
    if (editing?.id === p.id) resetForm();
    message('#form-msg', 'Publication supprimée.', 'ok');
    await loadPosts();
  } catch (err) {
    console.error(err);
    button.disabled = false;
    message('#form-msg', `Suppression impossible : ${err.message}`, 'err');
  }
}
