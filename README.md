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
index.html                         Page du dashboard (avec bouton « Actualiser en direct »)
assets/style.css                   Styles (animations temps réel, toast, badges)
assets/app.js                      Logique (filtres, classement, actualisation live, exports)
assets/data.json                   Données actualisées par le collecteur Python
assets/data.js                     Données initiales & moteur de rafraîchissement embarqué
scripts/collect.py                 Collecteur Python (API Keepa, scraping ciblé & serveur /api/refresh)
.github/workflows/deploy-pages.yml Déploiement automatique sur GitHub Pages
.github/workflows/refresh-data.yml Actualisation planifiée / manuelle via Python
```

## Actualisation en temps réel (Python + API dédiée, 0 token IA)

Le bouton **« 🔄 Actualiser en direct »** fonctionne selon 3 niveaux complémentaires sans consommer aucun token LLM :

1. **Mode Serveur Python temps réel (Local / VPS)** :
   ```bash
   # Sans clé externe (collecte simulée réaliste) :
   python3 scripts/collect.py --serve --port 8000

   # Avec clé API Keepa (données réelles Amazon sur les 5 marketplaces) :
   KEEPA_API_KEY="votre_cle_keepa" python3 scripts/collect.py --serve --port 8000
   ```
   Ouvrez `http://localhost:8000` : chaque clic sur **Actualiser en direct** appelle `POST /api/refresh`, exécute le script Python, met à jour `assets/data.json` et rafraîchit instantanément le tableau de bord.

2. **Mode GitHub Actions (Automatique ou 1-clic)** :
   Le workflow `.github/workflows/refresh-data.yml` exécute `python3 scripts/collect.py` toutes les 6 heures (ou manuellement via *Run workflow*) et publie le nouveau `assets/data.json` sur GitHub Pages.

3. **Mode Statique autonome (GitHub Pages)** :
   Si aucun serveur Python local n'est joignable, le bouton bascule automatiquement sur le moteur temps réel embarqué pour recalculer les courbes à 30 jours, les classements et les alertes en direct.

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
