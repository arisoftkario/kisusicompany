# Mise en service des Actualités (Firebase + Vercel)

La section « Actualités » du site et l'espace administrateur (`/admin.html`)
utilisent **Firebase** (publications, likes, abonnés, connexion) et **Vercel**
(photos et envoi des notifications). Tant que la configuration ci-dessous
n'est pas faite, la section reste masquée et le reste du site fonctionne normalement.

Durée : environ 20 minutes. Tout est gratuit pour un site de cette taille.

## 1. Créer le projet Firebase

1. Allez sur <https://console.firebase.google.com> et connectez-vous avec un compte Google.
2. **Ajouter un projet** → nom : `kisusi-company` → Google Analytics : facultatif.
3. Dans le projet, cliquez sur l'icône **Web `</>`** → nom : `Site KISUSI` → **Enregistrer**.
4. Firebase affiche un bloc `const firebaseConfig = { apiKey: ..., ... }`.
   Copiez ces valeurs dans **`web/js/firebase-config.js`**.

## 2. Activer la connexion

**Build → Authentication → Commencer**, puis dans **Sign-in method** :

- activez **Adresse e-mail/Mot de passe** (pour l'administrateur) ;
- activez **Anonyme** (pour les likes et abonnements des visiteurs, sans compte).

Dans **Authentication → Paramètres → Domaines autorisés**, vérifiez que
`kisusicompany.vercel.app` est présent (sinon, ajoutez-le).

## 3. Créer la base de données

1. **Build → Firestore Database → Créer une base de données** → emplacement
   `eur3 (europe-west)` → démarrer en **mode production**.
2. Onglet **Règles** : remplacez tout le contenu par celui du fichier
   **`firestore.rules`** de ce projet → **Publier**.

## 4. Créer le compte administrateur

1. **Authentication → Utilisateurs → Ajouter un utilisateur** : e-mail et mot de passe
   de l'administrateur. Copiez son **UID utilisateur** (colonne « UID »).
2. **Firestore Database → Données → Commencer une collection** :
   - ID de la collection : `admins`
   - ID du document : *l'UID copié*
   - un champ quelconque, par exemple `nom` = `KATEMBO KAMUHA GEDEON`

Pour ajouter un autre administrateur, répétez ces deux étapes.

## 5. Activer les notifications

**Paramètres du projet (roue dentée) → Cloud Messaging → Certificats Web Push →
Générer une paire de clés.** Copiez la clé dans `vapidKey` de `web/js/firebase-config.js`.

## 6. Donner à Vercel l'accès à Firebase

1. **Paramètres du projet → Comptes de service → Générer une nouvelle clé privée.**
   Un fichier `.json` est téléchargé. **Ne le mettez jamais dans le projet ni sur GitHub.**
2. Sur <https://vercel.com>, projet `kisusicompany` → **Settings → Environment Variables** :
   - Nom : `FIREBASE_SERVICE_ACCOUNT`
   - Valeur : tout le contenu du fichier `.json` (ouvrez-le avec le Bloc-notes, copiez tout)
   - Environnements : Production, Preview et Development

## 7. Activer le stockage des photos (Vercel Blob)

Sur Vercel, projet `kisusicompany` → **Storage → Create Database → Blob** →
nom `kisusi-photos` → **Create**, puis connectez-le au projet. La variable
`BLOB_READ_WRITE_TOKEN` est ajoutée automatiquement.

## 8. Publier

```
dart run build_runner build --release -o web:build
git add -A
git commit -m "Configuration Firebase"
git push
```

Puis sur Vercel, **Deployments → ⋯ → Redeploy** (pour prendre en compte les
variables d'environnement ajoutées).

## Utilisation au quotidien

- **Publier** : ouvrez `https://kisusicompany.vercel.app/admin.html` (bouton
  « Admin » dans le menu du site), connectez-vous, choisissez le type :
  - **Publication marketing** : texte + jusqu'à 6 photos, ou une vidéo (100 Mo
    maximum, de préférence MP4 en 720p) → section « Actualités » ;
  - **Produit en vente** : nom, prix, catégorie, photos… → « Catalogue », avec
    le bouton « Réserver en ligne ». Cochez « Vendu » une fois le véhicule vendu.
  La case « Envoyer une notification aux abonnés » prévient tous ceux qui suivent les actus.
- **Modifier / Supprimer** : boutons à côté de chaque publication.
- **Réservations** : les réservations faites depuis le catalogue apparaissent en haut
  de l'espace administrateur. Appelez ou écrivez au client, puis changez le statut
  (Confirmée → Acompte payé → Livrée).
- **Partage** : chaque publication a un lien `https://kisusicompany.vercel.app/actu/…`
  qui affiche sa photo et son titre dans l'aperçu WhatsApp/Facebook.

## Bon à savoir

- **iPhone** : les notifications ne fonctionnent que si le visiteur a installé
  l'application (bouton « Installer » → « Sur l'écran d'accueil ») et touche
  « Suivre les actus » depuis l'icône installée. C'est une limite d'Apple.
- **Likes sans compte** : un like par téléphone/navigateur. Quelqu'un qui change
  de navigateur peut liker une deuxième fois.
- **Tester en local** : `webdev serve` affiche la section, mais l'envoi des photos et
  des notifications passe par les fonctions de Vercel (`npx vercel dev`).
