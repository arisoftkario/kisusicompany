// Service worker KISUSI COMPANY : permet l'installation du site,
// l'affichage de la dernière version consultée hors connexion et
// les notifications des nouvelles publications.
// Stratégie « réseau d'abord » : le contenu en ligne est toujours prioritaire.
const CACHE = 'kisusi-v4';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['./', 'index.html', 'styles.css', 'main.dart.js', 'images/logo-k.png']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  // Fonctions serveur, pages de partage et administration : toujours en direct.
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/') || path.startsWith('/actu/') || path.endsWith('/admin.html')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      // Hors connexion : version en cache, et la page d'accueil seulement pour
      // une navigation (pas à la place d'une image ou d'un script manquant).
      .catch(() => caches.match(request).then((cached) =>
        cached || (request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

// Notification envoyée par /api/notify (message « data » de Firebase Cloud Messaging).
self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch (_) {}
  const data = message.data || message;
  event.waitUntil(
    self.registration.showNotification(data.title || 'KISUSI COMPANY', {
      body: data.body || 'Nouvelle publication sur le site KISUSI.',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      image: data.image || undefined,
      tag: data.tag || 'kisusi-actus',
      data: { url: data.url || './#actus' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './#actus', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      // navigate() échoue sur une fenêtre non contrôlée : on en ouvre une nouvelle.
      if (open) return open.navigate(url).then((w) => (w || open).focus()).catch(() => self.clients.openWindow(url));
      return self.clients.openWindow(url);
    })
  );
});
