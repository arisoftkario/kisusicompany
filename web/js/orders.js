// Réservation en ligne d'un véhicule du catalogue : le client choisit son
// agence (Butembo ou Beni) et verse l'avance fixée pour le véhicule dans
// l'espace administrateur (Airtel Money, Orange Money, M-Pesa ou virement
// bancaire), le reste à la livraison.
// La réservation est enregistrée dans Firebase (visible dans admin.html) ;
// sans Firebase, elle est simplement envoyée sur WhatsApp.
import { isConfigured } from './firebase-config.js';
import { firebase, signedInUser, usd } from './firebase.js';

const WHATSAPP = '243980957817';

const $ = (selector) => document.querySelector(selector);
const dialog = $('#order-dialog');
const form = $('#order-form');
let vehicle = null; // { name, year, price, deposit, credit }

// Le catalogue est redessiné à chaque filtre : on écoute donc son conteneur.
$('#catalog')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-order]');
  if (!btn) return;
  open({
    name: btn.dataset.order,
    year: Number(btn.dataset.year),
    price: Number(btn.dataset.price),
    deposit: Number(btn.dataset.deposit),
    credit: btn.dataset.credit === 'true',
  });
});
form?.addEventListener('submit', submit);
form?.addEventListener('change', (e) => {
  if (e.target.name === 'agency') $('#order-agency').classList.remove('is-invalid');
  if (e.target.name === 'payment') $('#order-payment').classList.remove('is-invalid');
});
form?.addEventListener('input', (e) => e.target.classList.remove('is-invalid'));

function open(v) {
  vehicle = v;
  $('#order-vehicle').textContent = `${v.name} (${v.year})`;
  $('#order-price').textContent = usd(v.price);
  $('#order-deposit').textContent = `${usd(v.deposit)} (${rate(v)} %)`;
  $('#order-rest').textContent = `Reste à payer : ${usd(v.price - v.deposit)}, à la livraison (ou en mensualités pour un achat à crédit).`;
  const credit = form.querySelector('[name=mode][value=credit]');
  credit.disabled = !v.credit;
  if (!v.credit) form.querySelector('[name=mode][value=comptant]').checked = true;
  form.hidden = false;
  $('#order-done').hidden = true;
  say('');
  dialog.showModal();
}

/// Part du prix que représente l'avance, en %.
const rate = (v) => Math.round((v.deposit / v.price) * 100);

function say(text) {
  $('#order-msg').textContent = text;
  $('#order-msg').hidden = !text;
}

const MODES = { comptant: 'Comptant', credit: 'À crédit' };
const PAYMENTS = {
  'airtel-money': 'Airtel Money',
  'orange-money': 'Orange Money',
  'm-pesa': 'M-Pesa',
  virement: 'Virement bancaire',
};

async function submit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const name = data.name.trim();
  const phone = data.phone.trim();
  const phoneOk = phone.replace(/\D/g, '').length >= 9;
  form.elements.name.classList.toggle('is-invalid', name.length < 2);
  form.elements.phone.classList.toggle('is-invalid', !phoneOk);
  $('#order-agency').classList.toggle('is-invalid', !data.agency);
  $('#order-payment').classList.toggle('is-invalid', !data.payment);
  const missing = [
    name.length < 2 && 'votre nom',
    !phoneOk && 'un numéro de téléphone valide',
    !data.agency && 'votre agence',
    !data.payment && 'le mode de paiement',
  ].filter(Boolean);
  if (missing.length) return say(`À compléter : ${missing.join(', ')}.`);

  const order = {
    vehicle: `${vehicle.name} (${vehicle.year})`,
    price: vehicle.price,
    depositRate: rate(vehicle),
    deposit: vehicle.deposit,
    name,
    phone,
    city: data.city,
    agency: data.agency,
    mode: data.mode,
    payment: data.payment,
    note: data.note.trim(),
  };

  const button = e.submitter;
  button.disabled = true;
  button.textContent = 'Envoi…';
  let ref = '';
  if (isConfigured) {
    try {
      const fb = await firebase();
      const user = await signedInUser(fb);
      const doc = await fb.F.addDoc(fb.F.collection(fb.db, 'orders'), {
        ...order, uid: user.uid, status: 'nouvelle', createdAt: fb.F.serverTimestamp(),
      });
      ref = doc.id.slice(0, 6).toUpperCase();
    } catch (err) {
      // Enregistrement impossible : la réservation passera par WhatsApp.
      console.error(err);
    }
  }
  button.disabled = false;
  button.textContent = 'Envoyer ma réservation';
  showDone(order, ref);
}

function showDone(order, ref) {
  form.hidden = true;
  $('#order-done').hidden = false;
  $('#order-done-title').textContent = ref ? `Réservation n° ${ref} enregistrée ✓` : 'Dernière étape';
  $('#order-done-text').textContent = ref
    ? `Merci ${order.name} ! Nous vous appelons très vite au ${order.phone} pour confirmer la disponibilité du véhicule.`
    : 'Envoyez votre réservation sur WhatsApp pour que nous la recevions. Nous vous répondons rapidement.';
  $('#order-done-pay').textContent = (order.payment === 'virement'
    ? `Après confirmation, nous vous envoyons nos coordonnées bancaires pour le virement de l'avance de ${usd(order.deposit)}.`
    : `Après confirmation, nous vous envoyons le numéro ${PAYMENTS[order.payment]} pour verser l'avance de ${usd(order.deposit)}.`)
    + ` Votre dossier est suivi par notre agence de ${order.agency}.`;

  const message = [
    `Bonjour KISUSI COMPANY, je réserve en ligne${ref ? ` (réservation n° ${ref})` : ''} :`,
    `• Véhicule : ${order.vehicle}`,
    `• Prix : ${usd(order.price)} — avance ${order.depositRate} % : ${usd(order.deposit)}`,
    `• Achat : ${MODES[order.mode]}`,
    `• Paiement de l'avance : ${PAYMENTS[order.payment]}`,
    `• Agence : ${order.agency}`,
    `• Nom : ${order.name}`,
    `• Téléphone : ${order.phone}`,
    `• Ville : ${order.city}`,
    order.note && `• Message : ${order.note}`,
  ].filter(Boolean).join('\n');
  $('#order-wa').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
  $('#order-wa span').textContent = ref ? 'Confirmer aussi sur WhatsApp' : 'Envoyer sur WhatsApp';
  form.reset();
}
