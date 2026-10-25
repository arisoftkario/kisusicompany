// Service worker KISUSI COMPANY : permet l'installation du site et
// l'affichage de la dernière version consultée hors connexion.
// Stratégie « réseau d'abord » : le contenu en ligne est toujours prioritaire.
const CACHE = 'kisusi-v1';

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

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('index.html')))
  );
});
