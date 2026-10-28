// Produits en vente publiés depuis l'espace administrateur (collection
// « products ») : dès qu'il y en a un, ils remplacent les véhicules
// d'exemple du catalogue (affichage par web/main.dart).
import { isConfigured } from './firebase-config.js';
import { firebase } from './firebase.js';

if (isConfigured && document.querySelector('#catalog')) load().catch(console.error);

async function load() {
  const { db, F } = await firebase();
  const snap = await F.getDocs(F.query(F.collection(db, 'products'), F.orderBy('createdAt', 'desc'), F.limit(60)));
  if (snap.empty) return;

  const products = snap.docs.map((d) => {
    const p = d.data();
    return {
      id: d.id,
      name: p.title,
      description: p.text ?? '',
      category: p.category ?? '',
      year: p.year ?? 0,
      km: p.km ?? 0,
      fuel: p.fuel ?? '',
      price: p.price ?? 0,
      depositRate: p.depositRate ?? 60,
      credit: p.credit !== false,
      fromJapan: p.fromJapan === true,
      sold: p.sold === true,
      photos: (p.media ?? []).filter((m) => m.kind === 'image').map((m) => m.url),
    };
  });
  // Disponibles d'abord, vendus ensuite.
  products.sort((a, b) => a.sold - b.sold);

  // main.dart lit window.kisusiProducts au démarrage, ou reçoit l'événement.
  window.kisusiProducts = products;
  window.dispatchEvent(new CustomEvent('kisusi:products', { detail: products }));
  requestAnimationFrame(showDeepLink);
}

/// Lien reçu par notification ou partage : /?produit=<id>.
function showDeepLink() {
  const id = new URLSearchParams(location.search).get('produit');
  const card = id && document.getElementById(`produit-${id}`);
  if (!card) return;
  card.classList.add('is-highlight');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
