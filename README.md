# TournéePro 🚚

SaaS léger de **planification de tournées commerciales & livraison** avec mini-CRM intégré, carte interactive, calcul des heures, des kilomètres et du **coût carburant**.

## Lancer l'application

Le routage utilise des services en ligne (OSRM / Nominatim), il faut donc une connexion internet et servir les fichiers via HTTP (pas en `file://`).

```bash
cd TourneePro
python3 -m http.server 8000
```

Puis ouvrez **http://localhost:8000** dans votre navigateur.

## Fonctionnalités

**CRM Clients** — fiches clients (société, contact, téléphone, email, adresse, type, priorité, notes), recherche, géolocalisation par adresse. Les données sont stockées dans le navigateur (localStorage). 5 clients de démonstration (Paris) sont chargés au premier lancement.

**Tournée** — point de départ (dépôt), ajout d'arrêts depuis le CRM, réordonnancement manuel, optimisation automatique de l'ordre (plus proche voisin), retour au dépôt optionnel.

**Carte** — fond OpenStreetMap (Leaflet), marqueurs numérotés, tracé de l'itinéraire **routier réel** via OSRM.

**Calculs** — distance (km), temps de conduite, temps de service (min/arrêt), durée totale.

**Coût** — calculé ainsi :

```
Litres        = km × (consommation L/100km ÷ 100)
Coût carburant = Litres × prix €/L
Main d'œuvre   = (durée totale en h) × coût horaire €/h
Coût total     = Coût carburant + Main d'œuvre
```

**Export CSV** — feuille de route détaillée + synthèse des coûts (ouvrable dans Excel).

## Structure

```
TourneePro/
├── index.html        Interface
├── css/styles.css    Styles
└── js/
    ├── store.js      Persistance locale + données démo
    ├── geo.js        Géocodage (Nominatim) + routage (OSRM) + optimisation
    ├── crm.js        Mini-CRM (formulaire, tableau)
    ├── route.js      Moteur de calcul heures / km / coût
    └── app.js        Orchestration (carte, navigation, tournée, export)
```

## Notes

- Les API OSRM et Nominatim publiques sont gratuites mais limitées en débit ; pour un usage intensif, hébergez vos propres instances ou utilisez une clé d'API commerciale.
- Toutes les données restent **dans votre navigateur** — rien n'est envoyé sur un serveur (hors requêtes de géocodage/routage).
