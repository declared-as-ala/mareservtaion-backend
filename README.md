# Ma Reservation — Backend API

API backend pour **Ma Reservation** (réservations tables, chambres, sièges).

## Variables d'environnement

Créer un fichier `.env` à partir de `.env.example` :

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | Chaîne de connexion MongoDB Atlas (obligatoire) |
| `JWT_SECRET` | Secret pour les tokens JWT |
| `REFRESH_TOKEN_SECRET` | Secret pour les refresh tokens |
| `FRONTEND_URL` | URL du frontend (CORS, ex: https://mareservation-frontend.vercel.app) |

## Installation

```bash
npm install
cp .env.example .env
# Éditer .env avec vos valeurs
```

## Scripts

- `npm run dev` — Démarrer en mode développement (tsx watch)
- `npm run build` — Compiler TypeScript
- `npm start` — Démarrer en production locale
- `npm run seed` — Peupler la base (utilisateurs, lieux, réservations)

## Déploiement sur Vercel

1. **Importer le repo GitHub** sur [vercel.com](https://vercel.com)
2. **Configurer les variables d'environnement** :
   - `MONGO_URI`
   - `JWT_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `FRONTEND_URL` = URL de votre frontend déployé (ex: https://mareservation-frontend.vercel.app)
3. **Déployer** — Vercel détecte automatiquement la config serverless
4. **Test** : `GET https://votre-projet.vercel.app/health`  
   Réponse attendue : `{ "status": "ok", "db": "connected", "timestamp": "..." }`

## Endpoints principaux

- `GET /health` — Santé + connexion DB
- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `GET /me`
- `GET /api/venues`, `GET /api/venues/:id`
- `POST /api/reservations`, `GET /api/reservations/me`
- `GET /api/search?q=...`
- `GET /api/admin/*` — Admin uniquement
