# MaTable / Ma Reservation — Backend (`backend/`)

This document helps AI assistants understand **what this API serves**, **the product goal**, and **how the Express + MongoDB server is organized**.

---

## What is this application?

**Ma Reservation** (API name surfaced as *Ma Reservation API*) powers a **French** booking and discovery product:

- Operators manage **venues**, **events**, **tables/rooms**, **categories/tags**, **banner slides**, and **immersive virtual tours**.
- End users **search**, **view venues/events**, and create **reservations** (tables, rooms, seats) with conflict checks.
- **Table placements** in **360°** or **Matterport** space are stored in MongoDB and exposed publicly so the client can render **markers with real-time-ish status** for a chosen time window (overlapping **Reservation** + active **ReservationHold**).

**Goal:** a **reliable REST API**: JWT auth with refresh cookies, role-based **admin** routes, file uploads for media, and clear `/api/v1/*` contracts for the Next.js frontend.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | **Node.js**, **ES modules** (`"type": "module"`) |
| HTTP | **Express 4** |
| DB | **MongoDB** via **Mongoose 8** |
| Auth | **JWT** access tokens; **httpOnly** refresh cookie; **bcrypt** for passwords |
| Uploads | **Multer** → disk under `uploads/` (images/videos); size limit from **`UPLOAD_MAX_FILE_SIZE_MB`** in `.env` |
| Security | **helmet**, **cors** (credentials), **express-rate-limit** on `/api/v1`, **cookie-parser** |
| Validation | **express-validator** / **zod** (per route) |

---

## Entry points

- **`src/server.ts`**: loads `.env`, connects DB, `app.listen(PORT)` (default **3001**).
- **`src/app.ts`**: builds Express `app`, mounts middleware + all routers under **`/api/v1/*`** and legacy **`/api/*`** mirrors.

**Health:** `GET /api/v1/health` — checks Mongo connection state.

---

## API surface (v1)

Mounted in `src/app.ts` (all prefixed with `/api/v1`):

| Mount path | Router file | Purpose |
|------------|-------------|---------|
| `/categories` | `routes/categories.ts` | Categories |
| `/tags` | `routes/tags.ts` | Tags |
| `/meta` | `routes/meta.ts` | Site meta / homepage config |
| `/venues` | `routes/venues.ts` | Public venues, detail, **table-placements** (with optional `startAt`/`endAt` for status) |
| `/tables` | `routes/tables.ts` | Table-related public ops |
| `/events` | `routes/events.ts` | Events |
| `/reservations` | `routes/reservations.ts` | Availability, holds, create/cancel, user reservations |
| `/auth` | `routes/auth.ts` | Register, login, refresh, me, logout |
| `/search` | `routes/search.ts` | Search |
| `/uploads` | `routes/uploads.ts` | Authenticated image/video upload; static files served from `/uploads` |
| `/admin` | `routes/admin.ts` | **ADMIN-only** CRUD: users, venues, events, tables, **table-placements**, virtual tours, banner slides, stats, etc. |
| `/organizer` | `routes/organizer.ts` | Organizer-facing endpoints |

**Legacy:** same routers also mounted under `/api/*` for backward compatibility during migration.

---

## Auth model

- **`authenticate` middleware** (`middleware/auth.ts`): reads **Bearer** JWT from `Authorization`, sets `req.userId` / role when valid.
- **`requireAdmin`**: guards `/api/v1/admin/*`.
- **Refresh**: `POST /api/v1/auth/refresh` issues new access token and rotates refresh **cookie** (frontend must use `credentials: 'include'`).
- Access token TTL and refresh cookie lifetime are configured in **`routes/auth.ts`** via env (e.g. `ACCESS_EXPIRY`, `REFRESH_EXPIRY_DAYS`).

---

## Core data models (conceptual)

Located under **`src/models/`** (Mongoose schemas). Important entities:

- **User** — roles include **ADMIN** vs normal user.
- **Venue** — publishing, immersive fields (`immersiveType`, `immersiveProvider`, `immersiveUrl`, `immersiveFile`, …).
- **Table** — per-venue reservable units (capacity, price, `defaultStatus`, etc.).
- **TablePlacement** — links `tableId` + `venueId` + `sceneId`; position either **`yaw_pitch`** (360) or **`matterport_anchor`** (`anchorPosition`, `stemVector`, **`floorIndex`** for stable Matterport tags).
- **Reservation** — booking window `startAt`/`endAt`, `tableId` / `roomId` / `seatId`, status (PENDING, CONFIRMED, …).
- **ReservationHold** — short-lived hold; used in availability / placement status when overlapping active holds should show as reserved.
- **Event**, **VirtualTour**, **BannerSlide**, **Category**, **Tag**, **AppSettings**, etc.

**Public placement + status:** `GET /api/v1/venues/:id/table-placements` returns placements with embedded table info and a computed **`status`** from overlapping reservations and **active, non-expired holds** when `startAt`/`endAt` query params are provided.

---

## File uploads

- **Middleware:** `src/middlewares/upload.middleware.ts` — `uploadImage`, `uploadVideo`; both use the same limit: **`UPLOAD_MAX_FILE_SIZE_MB`** (parsed as a number; if missing/invalid, code falls back to **5000** MB). Set explicitly in `.env` for production (e.g. `30`, `200`).
- **Routes:** `src/routes/uploads.ts` — e.g. `POST /api/v1/uploads/image` (authenticated).
- **Static serving:** `app.use('/uploads', express.static(UPLOAD_DIR))` so URLs like `/uploads/images/<file>` work when `API_BASE_URL` is correct.

After changing `.env`, **restart** the Node process.

---

## Project layout (backend)

```
backend/
├── src/
│   ├── app.ts              # Express app assembly
│   ├── server.ts           # listen()
│   ├── config/             # database, logger
│   ├── middlewares/        # auth, upload, rate limit, errors
│   ├── models/             # Mongoose models
│   ├── routes/             # route modules
│   ├── utils/              # helpers (slug, conflicts, QR, etc.)
│   └── scripts/            # seed, one-off scripts
├── uploads/                # default local storage (gitignored as appropriate)
└── package.json
```

---

## Conventions for changes

1. Prefer **new** endpoints under **`/api/v1`**; keep legacy `/api` only if mirroring is still required.
2. Protect mutations with **`authenticate`** / **`requireAdmin`** as appropriate.
3. Return consistent JSON; many admin handlers return raw documents — frontend uses `apiGetRaw` / `apiPostRaw`.
4. When adding fields used by immersive UIs (e.g. **`floorIndex`** on `TablePlacement`), update **model**, **admin create/patch**, **public venues route**, and **frontend types** together.
5. Run **`npm run build`** (`tsc`) from `backend/` to verify TypeScript compiles.

---

## Local dev

```bash
cd backend
npm install
# Set MONGO_URI, JWT_SECRET, CORS_ORIGIN / FRONTEND_URL, UPLOAD_MAX_FILE_SIZE_MB, etc. in .env
npm run dev    # tsx watch src/server.ts → port 3001
```

---

## Related doc

See **`../frontend/CLAUDE.md`** for Next.js route groups, client API wrapper, and immersive UI components.
