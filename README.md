# Site web — KISUSI COMPANY

Site vitrine de KISUSI COMPANY (vente de véhicules et motos au comptant et à crédit, export Japon → RD Congo).

## Structure

- `web/index.html` — contenu des pages (textes, sections, contacts)
- `web/styles.css` — mise en page et couleurs de la marque
- `web/main.dart` — catalogue, filtres, simulateur de crédit, formulaire WhatsApp, menu mobile
- `web/images/` — logos et photos

## Modifier le contenu

- **Catalogue** : liste `vehicles` en haut de `web/main.dart` (nom, catégorie, photo, année, km, prix…).
  Les photos se placent dans `web/images/`, de préférence au format WebP (plus léger).
- **Aperçu WhatsApp/Facebook** : `web/images/og-image.jpg` (1200×630, garder le format JPG).
- **Référencement** : bloc `application/ld+json` dans `web/index.html` (adresse, horaires, téléphone),
  `web/robots.txt` et `web/sitemap.xml`.
- **Taux du crédit** : constante `tauxMensuelCredit` dans `web/main.dart`.
- **Numéro WhatsApp** : constante `whatsappNumber` dans `web/main.dart` (et les liens `wa.me` / `tel:` dans `index.html`).
- **Adresse / horaires** : section « Contact » de `web/index.html`.

## Publications et espace administrateur

Deux types de publication, gérés depuis `admin.html` (publier, modifier, supprimer) :

1. **Publication marketing** (collection `posts`) — texte + photos ou vidéo de remise,
   affichée dans « Actualités » avec likes, partage et notifications.
2. **Produit en vente** (collection `products`) — moto ou véhicule : prix, année,
   kilométrage, photos, crédit, « Vendu ». Affiché dans le « Catalogue » avec
   « Réserver en ligne » ; il remplace les véhicules d'exemple de `web/main.dart`.

Mise en service : voir **[FIREBASE.md](FIREBASE.md)**.

- `web/js/firebase-config.js` — clés Firebase (sections masquées tant qu'elles sont vides)
- `web/js/actus.js` — « Actualités » ; `web/js/catalog.js` — produits du catalogue ; `web/js/admin.js` — espace administrateur
- `api/` — fonctions Vercel : photos et vidéos (`media.js`), notifications (`notify.js`), aperçu de partage (`actu.js`)
- `firestore.rules` — règles de sécurité à coller dans la console Firebase

## Réservation en ligne

Bouton « Réserver en ligne » sur chaque véhicule du catalogue (`web/js/orders.js`) :
le client choisit son agence (Butembo ou Beni), comptant/crédit et le paiement de l'avance
(Airtel Money, Orange Money, M-Pesa, virement bancaire). Le pourcentage d'avance (60 ou 70 %)
est fixé pour chaque produit dans l'espace admin ; véhicules d'exemple : `defaultAdvanceRate`. Les réservations s'affichent dans `admin.html`
(statut, appel, WhatsApp) ; sans Firebase, elles sont envoyées sur WhatsApp.

## Application installable (raccourci)

Le site peut être installé sur l'écran d'accueil (bouton « Installer » dans l'en-tête et le pied de page) :

- `web/manifest.webmanifest` — nom, couleurs et icônes de l'application
- `web/sw.js` — service worker (installation + dernière version consultée disponible hors connexion).
  Après une grosse mise à jour, augmentez le numéro dans `CACHE = 'kisusi-v5'` (v6, v7…).
- `web/icons/` — icônes de l'application

Sur Android/Chrome/Edge, le bouton ouvre la fenêtre d'installation du navigateur ; sur iPhone, il affiche les étapes « Partager → Sur l'écran d'accueil ».

## Lancer et publier

```
dart pub global activate webdev
webdev serve          # développement : http://localhost:8080
webdev build          # production : le dossier build/ est à mettre en ligne
# ou, si webdev ne trouve pas le SDK :
dart run build_runner build --release -o web:build
```

## Mise en ligne (Vercel)

Vercel ne compile pas le Dart : il publie directement le dossier `build/` (voir `vercel.json`).
Après chaque modification, recompiler puis envoyer sur GitHub :

```
dart run build_runner build --release -o web:build
git add -A && git commit -m "Mise à jour du site" && git push
```
