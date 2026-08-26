# Veille produits Amazon

Application de **veille des produits Amazon** : scan, filtrage par volume de ventes mensuel,
classement thématique et restitution via un tableau de bord web.

> 🔗 **Démo en ligne** : https://shinsekkai.github.io/veille-amazon/

Ce dépôt implémente le **dashboard de restitution** décrit dans le brief projet, publié sur
GitHub Pages. GitHub Pages ne servant que des fichiers **statiques**, la page présente
l'interface complète alimentée par un **jeu de données de démonstration** (`assets/data.js`).
La couche de collecte réelle est décrite plus bas.

## Fonctionnalités du dashboard

- **5 marketplaces** : amazon.fr, .de, .co.uk, .it, .es (bascule instantanée).
- **Filtre « badge de ventes »** : seuls les produits disposant de l'indicateur
  « X vendus le mois dernier » sont retenus (règle du brief).
- **Classement par catégorie Amazon native**, produits triés par **volume de ventes mensuel décroissant**.
- **Historique & courbes d'évolution** : sparkline 30 jours par produit + graphique détaillé dans la fiche.
- **Alertes automatiques** :
  - franchissement d'un **seuil de ventes** ;
  - **changement de classement** (progression / recul) ;
  - **nouveau produit détecté**.
- **Recherche** (titre, marque, ASIN) et **filtre de ventes minimales**.
- **Export CSV et Excel** du classement filtré courant.
- Interface responsive, thème sombre, **sans dépendance externe** (HTML/CSS/JS purs).

## Structure

```
index.html          Page du dashboard
assets/style.css     Styles
assets/app.js        Logique (filtres, classement, courbes SVG, alertes, exports)
assets/data.js       Données (DÉMO — à remplacer par la sortie du pipeline de collecte)
.github/workflows/   Déploiement automatique sur GitHub Pages (push sur main)
```

## Brancher des données réelles

Le dashboard consomme un objet `window.VEILLE_DATA` chargé depuis `assets/data.js`.
Pour passer en production, il suffit qu'un pipeline de collecte régénère ce fichier
(ou un `data.json` équivalent) au même format.

### Contraintes à trancher (rappel du brief, section 4bis)

- **La donnée « vendu le mois dernier » n'existe dans aucune API officielle.** La PA-API
  d'Amazon ne l'expose pas ; les services tiers (Keepa, Helium 10, Jungle Scout) fournissent
  des *estimations*. Choix retenu au brief : **estimations Keepa en proxy**, scraping direct
  réservé aux vérifications ciblées.
- **Volume & fréquence** (5 marketplaces, dizaines de milliers de produits, scan quotidien)
  impliquent des mesures de robustesse (délais, rotation de proxies) — hors budget gratuit.
- **Outils tiers payants** : un accès API (Keepa…) est nécessaire pour un usage automatisé.

> ⚠️ Le scraping automatisé des pages Amazon est encadré par ses conditions d'utilisation.
> Réservez tout usage à un cadre personnel et limité, et privilégiez les API officielles / services tiers.

## Déploiement

Chaque `push` sur `main` déclenche le workflow `.github/workflows/deploy-pages.yml`
qui publie la racine du dépôt sur GitHub Pages.
