# Resolving Vercel NOT_FOUND (404) Error — Complete Guide

## 1. The Fix

### Immediate changes to apply:

**A. Ensure the build creates the function file**

Your `api/index.mjs` is in `.gitignore` — it's **generated during build**. If the build fails, the file never exists → Vercel returns NOT_FOUND.

- ✅ Verify `npm run build:vercel` succeeds locally
- ✅ Check Vercel build logs — the build step must complete without errors
- ✅ Ensure `esbuild` is in `dependencies` (not just devDependencies) so it installs during Vercel's build

**B. Add a catch-all 404 handler in Express**

When a path doesn't match any route, Express returns 404. Adding an explicit handler ensures we always return a proper JSON response instead of an implicit 404 that can surface as NOT_FOUND:

```typescript
// At the END of app.ts, before export:
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: 'Use /api/* endpoints. Health check at /health'
  });
});
```

**C. Verify Vercel project settings**

- **Root Directory**: Leave empty (or `.`) if your backend is the repo root
- **Framework Preset**: "Other" (not Next.js, etc.)
- **Build Command**: Should match `vercel.json` or use `npm run build:vercel`
- **Output Directory**: Leave empty for serverless

---

## 2. Root Cause Analysis

### What was the code doing vs. what it needed to do?

| What it was doing | What it needed |
|-------------------|----------------|
| Relying on a build that creates `api/index.mjs` | Ensure build runs and produces the file before deployment |
| Express returning 404 for unmatched routes | Explicit 404 handler with JSON response |
| Rewriting all paths to `/api` | Path preservation so `/api/venues` reaches the correct handler |

### What conditions triggered this error?

1. **Build failure** — If `build:vercel` fails (esbuild missing, script error, etc.), `api/index.mjs` is never created. Vercel looks for it, doesn't find it → NOT_FOUND.

2. **Path mismatch** — Rewrite `"/(.*)" → "/api"` sends all requests to your function. If the *destination* path replaces the original (some proxy behavior), your function might receive only `/api` instead of `/api/venues`, and no route matches → 404.

3. **Unhandled paths** — Any path you didn't explicitly add a route for (e.g. `/api/unknown`) falls through to Express's default 404. That can appear as NOT_FOUND in Vercel logs.

### What misconception or oversight led to this?

- **Assuming the build always succeeds** — The function file doesn't exist in the repo; it's created at build time. A failed build means no function.
- **Treating 404 as "expected" for unknown routes** — Vercel and clients can treat generic 404s differently; an explicit handler gives you control.
- **Legacy `builds` config** — The `builds` + `buildCommand` setup is the older model; the Build Output API is the modern approach and can be more predictable.

---

## 3. Understanding the Concept

### Why does NOT_FOUND exist and what is it protecting?

NOT_FOUND (404) is HTTP's standard "resource not found" response. It protects you by:

- Clearly distinguishing "this URL doesn't exist" from "server error" (500)
- Allowing clients to handle missing resources (retry, show a message, etc.)
- Keeping the contract: the server commits to what it serves

### Correct mental model

```
Request flow on Vercel:
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│ Vercel Edge  │────▶│ Your Function   │
│  GET /      │     │ - Rewrites   │     │ api/index.mjs   │
└─────────────┘     │ - Routes     │     │ (Express app)   │
                   └──────────────┘     └─────────────────┘
                            │                      │
                            │ NOT_FOUND if:        │ 404 if:
                            │ - No function file   │ - No matching route
                            │ - Route mismatch     │ - Explicit res.status(404)
                            │ - Build failed       │
                            ▼                      ▼
```

### How this fits into the framework

- **Vercel**: Decides which serverless function to run based on path and `vercel.json`. If the function file is missing or the route doesn't match, it returns NOT_FOUND before your code runs.
- **Express**: Handles the request once it reaches your function. If no route matches, it sends 404 by default.
- **Your app**: Must have a valid function file (from build) and routes (or a catch-all) for all paths you care about.

---

## 4. Warning Signs & Similar Mistakes

### What to look for

- `api/index.mjs` (or your function file) in `.gitignore` → Build must succeed; add build verification.
- No explicit 404 handler → Add one for predictable behavior.
- Rewrites that might change the path → Test that `/api/venues` and similar paths reach the right handlers.
- `buildCommand` that can fail silently → Check Vercel build logs after each deploy.

### Similar mistakes in related scenarios

| Scenario | Mistake | Fix |
|----------|---------|-----|
| SPA (React/Vue) | No rewrite for client-side routes | Add `"/(.*)": "/index.html"` |
| Monorepo | Wrong root directory | Set Root Directory to `backend/` or similar |
| Serverless + DB | Function crashes before handling | Fix startup errors; add health checks |
| Multiple functions | Wrong path in `vercel.json` | Match `builds[].src` to actual file path |

### Code smells

- Build output (e.g. `api/index.mjs`) ignored by git but required for deploy
- No logging in the serverless handler to debug path and errors
- Assumption that "it works locally" means it will work on Vercel

---

## 5. Alternatives & Trade-offs

### Option A: Keep current setup (build + legacy `builds`)

- **Pros**: Single bundled file, full control over output
- **Cons**: Depends on build; more moving parts; legacy config
- **When**: You need one function for the whole app (typical for Express APIs)

### Option B: Vercel Build Output API (recommended long-term)

- Use `@vercel/node` with a custom output format
- **Pros**: Clearer separation of build and deploy, better tooling
- **Cons**: More migration work
- **When**: You want a more future-proof setup

### Option C: Multiple API files instead of one catch-all

- e.g. `api/venues.js`, `api/auth.js`, etc.
- **Pros**: Vercel routes each path to its own function; no rewrite for `/api/*`
- **Cons**: No shared Express app; more files; harder to share middleware/DB
- **When**: Endpoints are independent and don't need shared state

### Option D: Deploy Express as a single serverless function (current approach)

- One `api/index.mjs` handling everything via rewrites
- **Pros**: One codebase, shared middleware, DB connection, auth
- **Cons**: Cold starts for a larger function; rewrites must be correct
- **When**: Standard REST API with shared logic (your case)

---

## Summary Checklist

- [ ] `npm run build:vercel` succeeds locally
- [ ] `api/index.mjs` exists after build (even though it's gitignored)
- [ ] `esbuild` is in `dependencies`
- [ ] Explicit 404 handler in Express
- [ ] Vercel build logs show no errors
- [ ] Test `/`, `/health`, `/api/venues` on the deployed URL
