# Ma Reservation — Backend API

API backend pour **Ma Reservation** (réservations tables, chambres, sièges, visites 360°).

## Variables d'environnement

Créer un fichier `.env` à partir de `env.example` (ou `.env.example` si présent) :

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` ou `MONGO_URI` | Chaîne de connexion MongoDB Atlas (obligatoire). Ne pas commiter. |
| `JWT_SECRET` | Secret pour les tokens JWT (production : valeur forte) |
| `REFRESH_TOKEN_SECRET` | Secret pour les refresh tokens |
| `FRONTEND_URL` | URL du frontend (CORS, ex: https://mareservtaion-frontend.vercel.app) |
| `CORS_ORIGIN` | Optionnel, même que FRONTEND_URL |

## Installation

```bash
npm install
cp env.example .env
# Éditer .env avec MONGODB_URI, JWT_SECRET, FRONTEND_URL
```

## Scripts

- `npm run dev` — Démarrer en mode développement (tsx watch)
- `npm run build` — Compiler TypeScript
- `npm start` — Démarrer en production locale
- `npm run seed` — Peupler la base (catégories, utilisateurs, lieux, visites 360°, hotspots, réservations)
- `npm run build:vercel` — Bundle pour Vercel (génère api/index.mjs)

## Déploiement sur Vercel

1. **Importer le repo** : https://github.com/declared-as-ala/mareservtaion-backend
2. **Variables d'environnement** dans le projet Vercel :
   - `MONGODB_URI` (ou `MONGO_URI`)
   - `JWT_SECRET`
   - `FRONTEND_URL` = URL du frontend (ex: https://mareservtaion-frontend.vercel.app)
3. **Build** : le projet utilise `vercel.json` avec `buildCommand: npm run build:vercel` et route tout vers `api/index.mjs`.
4. **Test santé** : `GET https://votre-projet.vercel.app/api/v1/health`  
   Réponse attendue : `{ "status": "ok", "db": "connected", "timestamp": "..." }`

En cas de 404 sur la racine ou `/api/v1/health` : vérifier que le déploiement a bien exécuté le build et que les routes pointent vers `api/index.mjs`. Cold start peut retarder la première réponse.

## Endpoints principaux (préfixe /api/v1)

- `GET /api/v1/health` — Santé + connexion DB
- `GET /api/v1/categories` — Liste des catégories
- `GET /api/v1/venues`, `GET /api/v1/venues/:idOrSlug` — Lieux (filtres : type, city, categoryId, hasEvent, hasVirtualTour, q)
- `GET /api/v1/venues/:id/virtual-tours`, `GET /api/v1/venues/:id/hotspots`
- `GET /api/v1/events`, `GET /api/v1/events/:idOrSlug`
- `GET /api/v1/search?q=...`
- `POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `GET /me`
- `POST /api/v1/reservations`, `GET /api/v1/reservations/me`, `GET /api/v1/reservations/:id/ticket`, `PATCH /api/v1/reservations/:id/cancel`
- `GET /api/v1/admin/*` — Admin (overview, charts, users, venues, reservations, events, virtual-tours, tour-hotspots)
