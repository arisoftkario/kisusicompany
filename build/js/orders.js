// Réservation en ligne d'un véhicule du catalogue : le client verse un
// acompte (Mobile Money ou à l'agence), le reste est réglé à la livraison.
// La réservation est enregistrée dans Firebase (visible dans admin.html) ;
// sans Firebase, elle est simplement envoyée sur WhatsApp.
import { isConfigured } from './firebase-config.js';
import { firebase, signedInUser, usd } from './firebase.js';

const WHATSAPP = '243980957817';

/// Part du prix demandée à la réservation (0.10 = 10 %).
const DEPOSIT_RATE = 0.10;

const $ = (selector) => document.querySelector(selector);
const dialog = $('#order-dialog');
const form = $('#order-form');
let vehicle = null; // { name, year, price, credit, deposit }

// Le catalogue est redessiné à chaque filtre : on écoute donc son conteneur.
$('#catalog')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-order]');
  if (!btn) return;
  const price = Number(btn.dataset.price);
  open({
    name: btn.dataset.order,
    year: Number(btn.dataset.year),
    price,
    credit: btn.dataset.credit === 'true',
    deposit: Math.round(price * DEPOSIT_RATE),
  });
});
form?.addEventListener('submit', submit);
form?.addEventListener('input', (e) => e.target.classList.remove('is-invalid'));

function open(v) {
  vehicle = v;
  $('#order-vehicle').textContent = `${v.name} (${v.year})`;
  $('#order-price').textContent = usd(v.price);
  $('#order-deposit').textContent = `${usd(v.deposit)} (${Math.round(DEPOSIT_RATE * 100)} %)`;
  const credit = form.querySelector('[name=mode][value=credit]');
  credit.disabled = !v.credit;
  if (!v.credit) form.querySelector('[name=mode][value=comptant]').checked = true;
  form.hidden = false;
  $('#order-done').hidden = true;
  say('');
  dialog.showModal();
}

function say(text) {
  $('#order-msg').textContent = text;
  $('#order-msg').hidden = !text;
}

const MODES = { comptant: 'Comptant', credit: 'À crédit' };
const PAYMENTS = { 'mobile-money': 'Mobile Money', agence: "À l'agence" };

async function submit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const name = data.name.trim();
  const phone = data.phone.trim();
  const phoneOk = phone.replace(/\D/g, '').length >= 9;
  form.elements.name.classList.toggle('is-invalid', name.length < 2);
  form.elements.phone.classList.toggle('is-invalid', !phoneOk);
  if (name.length < 2 || !phoneOk) return say('Indiquez votre nom et un numéro de téléphone valide.');

  const order = {
    vehicle: `${vehicle.name} (${vehicle.year})`,
    price: vehicle.price,
    deposit: vehicle.deposit,
    name,
    phone,
    city: data.city,
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
  $('#order-done-pay').textContent = order.payment === 'agence'
    ? `Acompte de ${usd(order.deposit)} à verser à notre siège de Butembo ou à notre agence de Beni, après notre confirmation.`
    : `Après confirmation, nous vous envoyons le numéro Mobile Money (M-Pesa, Airtel Money ou Orange Money) pour verser l'acompte de ${usd(order.deposit)}.`;

  const message = [
    `Bonjour KISUSI COMPANY, je réserve en ligne${ref ? ` (réservation n° ${ref})` : ''} :`,
    `• Véhicule : ${order.vehicle}`,
    `• Prix : ${usd(order.price)} — acompte ${usd(order.deposit)}`,
    `• Achat : ${MODES[order.mode]}`,
    `• Paiement de l'acompte : ${PAYMENTS[order.payment]}`,
    `• Nom : ${order.name}`,
    `• Téléphone : ${order.phone}`,
    `• Ville : ${order.city}`,
    order.note && `• Message : ${order.note}`,
  ].filter(Boolean).join('\n');
  $('#order-wa').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
  $('#order-wa span').textContent = ref ? 'Confirmer aussi sur WhatsApp' : 'Envoyer sur WhatsApp';
  form.reset();
}
