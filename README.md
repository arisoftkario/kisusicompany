# Site web — KISUSI COMPANY

Site vitrine de KISUSI COMPANY (vente de véhicules et motos au comptant et à crédit, export Japon → RD Congo).

## Structure

- `web/index.html` — contenu des pages (textes, sections, contacts)
- `web/styles.css` — mise en page et couleurs de la marque
- `web/main.dart` — catalogue, filtres, simulateur de crédit, formulaire WhatsApp, menu mobile
- `web/images/` — logos et photos

## Modifier le contenu

- **Catalogue** : liste `vehicles` en haut de `web/main.dart` (nom, catégorie, photo, année, km, prix…).
  Les photos se placent dans `web/images/`.
- **Taux du crédit** : constante `tauxMensuelCredit` dans `web/main.dart`.
- **Numéro WhatsApp** : constante `whatsappNumber` dans `web/main.dart` (et les liens `wa.me` / `tel:` dans `index.html`).
- **Adresse / horaires** : section « Contact » de `web/index.html`.

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
