// Section « Actualités » : publications marketing de KISUSI COMPANY (photos
// et vidéos de remise, nouveautés), likes (sans compte, un par appareil),
// partage et abonnement aux notifications. Les produits en vente sont
// affichés dans le catalogue (catalog.js).
import { isConfigured, vapidKey } from './firebase-config.js';
import { firebase, signedInUser, loadMessaging, PAGE_SIZE, dateFr, el, icon } from './firebase.js';

const WHATSAPP = '243980957817';
const SEEN_KEY = 'kisusi-actus-vu';

const section = document.querySelector('#actus');
const feed = document.querySelector('#feed');
const moreBtn = document.querySelector('#feed-more');
const followBtn = document.querySelector('#follow-btn');
const followCount = document.querySelector('#follow-count');
const followMsg = document.querySelector('#follow-msg');
const shareDialog = document.querySelector('#share-dialog');

let fb;
let lastDoc = null;
let followers = 0;
let lastSeen = 0;
const shown = new Set();

if (isConfigured && section) start();

// localStorage peut être indisponible (navigation privée) : on s'en passe.
function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
}

async function start() {
  section.hidden = false;
  const links = document.querySelectorAll('[data-actus-link]');
  links.forEach((a) => (a.hidden = false));
  lastSeen = Number(storage(SEEN_KEY)) || 0;

  moreBtn.addEventListener('click', () => loadPage().catch(console.error));
  followBtn.addEventListener('click', toggleFollow);
  setupShareDialog();

  try {
    fb = await firebase();
    await loadPage();
    await showDeepLink();
    if (feed.querySelector('.post__new')) {
      document.querySelector('.nav [data-actus-link]')
        ?.append(el('span', { class: 'nav__dot', 'aria-hidden': 'true' }));
    }
    storage(SEEN_KEY, String(Date.now()));
    refreshFollow();
  } catch (e) {
    console.error(e);
    feed.replaceChildren(el('p', { class: 'feed__empty', text: 'Impossible de charger les actualités pour le moment.' }));
  }
}

const ensureUser = () => signedInUser(fb);

// ---------------------------------------------------------------------------
// Publications
// ---------------------------------------------------------------------------

async function loadPage() {
  const { db, F } = fb;
  moreBtn.disabled = true;
  const constraints = [F.orderBy('createdAt', 'desc')];
  if (lastDoc) constraints.push(F.startAfter(lastDoc));
  constraints.push(F.limit(PAGE_SIZE));
  const snap = await F.getDocs(F.query(F.collection(db, 'posts'), ...constraints));

  if (!lastDoc) feed.replaceChildren();
  snap.docs.forEach((d) => addPost(d));
  lastDoc = snap.docs.at(-1) ?? lastDoc;
  moreBtn.hidden = snap.size < PAGE_SIZE;
  moreBtn.disabled = false;

  if (!feed.children.length) {
    feed.append(el('p', {
      class: 'feed__empty',
      text: 'Aucune publication pour le moment. Suivez-nous pour être prévenu des prochaines offres.',
    }));
  }
}

function addPost(snap, prepend = false) {
  if (shown.has(snap.id)) return;
  shown.add(snap.id);
  feed.querySelector('.feed__empty')?.remove();

  const p = snap.data();
  const created = p.createdAt?.toMillis?.() ?? Date.now();
  const url = `${location.origin}/actu/${snap.id}`;
  const interest =
    `Bonjour KISUSI COMPANY, je suis intéressé(e) par votre publication « ${p.title} » : ${url}`;

  const text = el('p', { class: 'post__text', text: p.text });
  const readMore = el('button', { type: 'button', class: 'post__more', text: 'Lire la suite', hidden: true });
  const likeBtn = el('button', {
    type: 'button', class: 'post__like', 'aria-pressed': 'false', 'aria-label': `J'aime « ${p.title} »`,
  }, icon('i-heart'), el('span', { text: '0' }));
  const shareBtn = el('button', {
    type: 'button', class: 'icon-btn', title: 'Partager', 'aria-label': `Partager « ${p.title} »`,
  }, icon('i-share'));

  const card = el('article', { class: 'card post', id: `actu-${snap.id}` },
    media(p),
    el('div', { class: 'card__body' },
      el('div', { class: 'post__meta' },
        el('time', { datetime: new Date(created).toISOString(), text: dateFr(p.createdAt) }),
        lastSeen && created > lastSeen && el('span', { class: 'post__new', text: 'Nouveau' })),
      el('h3', { class: 'card__title', text: p.title }),
      text,
      readMore,
      el('div', { class: 'card__foot' },
        el('span'),
        el('div', { class: 'card__actions' },
          likeBtn,
          shareBtn,
          el('a', {
            class: 'icon-btn icon-btn--wa',
            href: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(interest)}`,
            target: '_blank', rel: 'noopener',
            title: 'Je suis intéressé(e)', 'aria-label': `Contacter KISUSI sur WhatsApp à propos de « ${p.title} »`,
          }, icon('i-whatsapp'))))));

  if (prepend) feed.prepend(card);
  else feed.append(card);

  // « Lire la suite » seulement quand le texte est coupé.
  requestAnimationFrame(() => {
    readMore.hidden = text.scrollHeight <= text.clientHeight + 2;
  });
  readMore.addEventListener('click', () => {
    const open = text.classList.toggle('is-open');
    readMore.textContent = open ? 'Réduire' : 'Lire la suite';
  });
  likeBtn.addEventListener('click', () => toggleLike(snap.id, likeBtn));
  shareBtn.addEventListener('click', () => share(p.title, url));
  loadLikes(snap.id, likeBtn);
}

/// Vidéo, ou photo(s) de la publication (défilement si plusieurs).
function media(p) {
  const items = p.media ?? [];
  const video = items.find((m) => m.kind === 'video');
  if (video) {
    const poster = items.find((m) => m.kind === 'image');
    return el('div', { class: 'card__media card__media--video' },
      el('video', { src: video.url, poster: poster?.url, controls: true, playsinline: true, preload: 'metadata' }));
  }
  const photos = items.filter((m) => m.kind === 'image');
  if (!photos.length) return null;
  const imgs = photos.map((m, i) => el('img', { src: m.url, alt: i ? '' : p.title, loading: 'lazy' }));
  if (photos.length === 1) return el('div', { class: 'card__media' }, ...imgs);
  return el('div', { class: 'card__media' },
    el('div', { class: 'card__slides' }, ...imgs),
    el('span', { class: 'card__count', text: `${photos.length} photos ›` }));
}

/// Lien reçu par notification ou partage : /?actu=<id> (ou #actu-<id>).
async function showDeepLink() {
  const hash = location.hash.startsWith('#actu-') ? location.hash.slice(6) : null;
  const id = new URLSearchParams(location.search).get('actu') || hash;
  if (!id) return;
  if (!shown.has(id)) {
    const snap = await fb.F.getDoc(fb.F.doc(fb.db, 'posts', id));
    if (snap.exists()) addPost(snap, true);
  }
  const card = document.getElementById(`actu-${id}`);
  if (!card) return;
  card.classList.add('is-highlight');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

function setLike(btn, liked, count) {
  btn.setAttribute('aria-pressed', String(liked));
  btn.querySelector('use').setAttribute('href', liked ? '#i-heart-fill' : '#i-heart');
  btn.querySelector('span').textContent = String(Math.max(0, count));
}

async function loadLikes(id, btn) {
  const { db, F, auth } = fb;
  try {
    const likes = F.collection(db, 'posts', id, 'likes');
    const [count] = await Promise.all([F.getCountFromServer(likes), auth.authStateReady()]);
    const uid = auth.currentUser?.uid;
    const liked = uid ? (await F.getDoc(F.doc(likes, uid))).exists() : false;
    setLike(btn, liked, count.data().count);
  } catch (e) {
    console.error(e);
  }
}

async function toggleLike(id, btn) {
  if (btn.disabled) return;
  const liked = btn.getAttribute('aria-pressed') !== 'true';
  const before = Number(btn.querySelector('span').textContent);
  setLike(btn, liked, before + (liked ? 1 : -1));
  btn.classList.toggle('is-pop', liked);
  btn.disabled = true;
  try {
    const user = await ensureUser();
    const ref = fb.F.doc(fb.db, 'posts', id, 'likes', user.uid);
    if (liked) await fb.F.setDoc(ref, { at: fb.F.serverTimestamp() });
    else await fb.F.deleteDoc(ref);
  } catch (e) {
    console.error(e);
    setLike(btn, !liked, before);
  }
  btn.disabled = false;
}

// ---------------------------------------------------------------------------
// Partage
// ---------------------------------------------------------------------------

async function share(title, url) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: `${title} — KISUSI COMPANY`, url });
    } catch {
      // Partage annulé par l'utilisateur.
    }
    return;
  }
  const text = encodeURIComponent(`${title} — KISUSI COMPANY ${url}`);
  shareDialog.querySelector('[data-share="whatsapp"]').href = `https://wa.me/?text=${text}`;
  shareDialog.querySelector('[data-share="facebook"]').href =
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const copy = shareDialog.querySelector('[data-share="copy"]');
  copy.dataset.url = url;
  copy.querySelector('span').textContent = 'Copier le lien';
  shareDialog.showModal();
}

function setupShareDialog() {
  const copy = shareDialog.querySelector('[data-share="copy"]');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copy.dataset.url);
      copy.querySelector('span').textContent = 'Lien copié ✓';
    } catch {
      prompt('Copiez ce lien :', copy.dataset.url);
    }
  });
}

// ---------------------------------------------------------------------------
// Suivre les actualités (notifications)
// ---------------------------------------------------------------------------

const pushSupported = () =>
  'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function renderFollow(following) {
  followBtn.setAttribute('aria-pressed', String(following));
  followBtn.classList.toggle('btn--red', !following);
  followBtn.classList.toggle('btn--outline', following);
  followBtn.querySelector('span').textContent = following ? 'Vous suivez ✓' : 'Suivre les actus';
  followCount.innerHTML = `<strong>${followers}</strong> abonné${followers > 1 ? 's' : ''}`;
}

function say(message) {
  followMsg.textContent = message;
  followMsg.hidden = !message;
}

async function refreshFollow() {
  const { db, F, auth } = fb;
  try {
    await auth.authStateReady();
    const uid = auth.currentUser?.uid;
    const [count, mine] = await Promise.all([
      F.getCountFromServer(F.collection(db, 'follows')),
      uid ? F.getDoc(F.doc(db, 'follows', uid)) : null,
    ]);
    followers = count.data().count;
    const following = Boolean(mine?.exists());
    renderFollow(following);
    // Le jeton de notification peut changer : on le renouvelle à chaque visite.
    if (following && pushSupported() && Notification.permission === 'granted') {
      saveToken(uid).catch(console.error);
    }
  } catch (e) {
    console.error(e);
  }
}

async function saveToken(uid) {
  const M = await loadMessaging();
  if (!(await M.isSupported())) throw new Error('Notifications non prises en charge');
  await navigator.serviceWorker.register('sw.js');
  const registration = await navigator.serviceWorker.ready;
  const token = await M.getToken(M.getMessaging(fb.instance), { vapidKey, serviceWorkerRegistration: registration });
  await fb.F.setDoc(fb.F.doc(fb.db, 'pushTokens', uid), { token, at: fb.F.serverTimestamp() });
}

async function toggleFollow() {
  if (!fb) return;
  const following = followBtn.getAttribute('aria-pressed') === 'true';
  followBtn.disabled = true;
  try {
    if (following) await unfollow();
    else await follow();
  } catch (e) {
    console.error(e);
    say('Une erreur est survenue. Vérifiez votre connexion et réessayez.');
  }
  followBtn.disabled = false;
}

async function follow() {
  // La demande d'autorisation doit partir directement du clic (exigence de Safari).
  const permission = pushSupported() ? await Notification.requestPermission() : 'unsupported';
  const user = await ensureUser();
  await fb.F.setDoc(fb.F.doc(fb.db, 'follows', user.uid), { at: fb.F.serverTimestamp() });
  followers += 1;
  renderFollow(true);

  if (permission === 'granted') {
    try {
      await saveToken(user.uid);
      say('Merci ! Vous recevrez une notification à chaque nouvelle publication KISUSI.');
    } catch (e) {
      console.error(e);
      say("Vous suivez KISUSI, mais les notifications n'ont pas pu être activées sur cet appareil.");
    }
  } else if (permission === 'unsupported') {
    say(isIos && !isStandalone
      ? "Vous suivez KISUSI. Pour recevoir les notifications sur iPhone, installez d'abord l'application (bouton « Installer »), ouvrez-la puis touchez « Suivre les actus »."
      : 'Vous suivez KISUSI. Ce navigateur ne gère pas les notifications : revenez sur le site pour voir les nouveautés.');
  } else {
    say('Vous suivez KISUSI. Les notifications sont bloquées : autorisez-les dans les réglages du navigateur pour être prévenu.');
  }
}

async function unfollow() {
  const user = await ensureUser();
  const { db, F } = fb;
  await Promise.all([
    F.deleteDoc(F.doc(db, 'follows', user.uid)),
    F.deleteDoc(F.doc(db, 'pushTokens', user.uid)),
  ]);
  try {
    const M = await loadMessaging();
    if (await M.isSupported()) await M.deleteToken(M.getMessaging(fb.instance));
  } catch {
    // Aucun jeton à supprimer.
  }
  followers = Math.max(0, followers - 1);
  renderFollow(false);
  say('Vous ne suivez plus les actualités KISUSI.');
}
