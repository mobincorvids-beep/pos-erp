# Deploying to Vercel

This project deploys as **two separate Vercel projects** from this one repo — a
backend (serverless API) and a frontend (static Vite build). This mirrors the
Docker setup in `docker-compose.yml` (which is still the right choice for a
VPS/container deployment); Vercel just needs the pieces split differently.

## 1. Backend project

- **Root Directory**: repo root (leave blank / `.`)
- Vercel auto-detects `api/index.js` as a serverless function; `vercel.json`
  at the root rewrites every request to it, so the existing Express routes
  under `/api/v1/*` and `/health` work unchanged.
- **Environment variables** (Project Settings → Environment Variables):
  - `MONGO_URI` — your MongoDB Atlas connection string, with a database name
    in the path (e.g. `.../pos_erp?retryWrites=true&w=majority`)
  - `JWT_SECRET` — a long random string (never reuse the example value)
  - `JWT_EXPIRES_IN` — e.g. `1h`
  - `CLIENT_ORIGIN` — the frontend project's URL once you have it (step 2),
    e.g. `https://your-frontend.vercel.app`
  - `PORT` — not used on Vercel (serverless has no listening port) but
    harmless to leave unset
- **MongoDB Atlas → Network Access**: add `0.0.0.0/0` ("Allow Access from
  Anywhere") — Vercel has no static outbound IP, so an IP allowlist can't
  target it directly.
- Note the deployed backend URL, e.g. `https://pos-erp-xxxx.vercel.app`.

## 2. Frontend project

- **Root Directory**: `client`
- Build command / output directory: Vercel auto-detects Vite (`npm run
  build`, output `dist`).
- `client/vercel.json` handles the SPA fallback so client-side routes
  (`/admin/companies`, etc.) don't 404 on refresh.
- **Environment variables**:
  - `VITE_API_BASE_URL` — the backend URL from step 1, **with** the API
    prefix, e.g. `https://pos-erp-xxxx.vercel.app/api/v1`
- Vite bakes `VITE_API_BASE_URL` in at **build time**, not runtime — changing
  it in the dashboard does nothing until you trigger a new deployment
  (Deployments → ⋯ → Redeploy).

## 3. Wire the two together

1. Deploy the backend first, copy its URL.
2. Set `VITE_API_BASE_URL` on the frontend to `<backend-url>/api/v1`, deploy
   the frontend, copy its URL.
3. Set `CLIENT_ORIGIN` on the backend to the frontend's URL, redeploy the
   backend (env var changes on serverless functions also need a redeploy to
   take effect on already-warm containers).
4. Visit `<backend-url>/health` — should return `{"status":"ok",
   "mongoConnected":true}`.
5. Visit the frontend URL and log in. If you ran `npm run seed` against the
   same `MONGO_URI`, use `admin@demo.test` / `password123` (or
   `cashier@demo.test` / `password123` for the restricted-role account).

## Common failure: "Failed to fetch" on login

Almost always one of:

- `VITE_API_BASE_URL` doesn't match the backend's actual URL (or is missing
  the `/api/v1` suffix) — check what the built bundle actually calls with
  the browser's Network tab.
- The frontend was redeployed *before* `VITE_API_BASE_URL` was set/updated —
  redeploy again now that it's set.
- `CLIENT_ORIGIN` on the backend doesn't exactly match the frontend's origin
  (scheme + host, no trailing slash) — a mismatch here is a CORS rejection,
  which also surfaces to the browser as a generic "Failed to fetch".
- MongoDB Atlas's Network Access list doesn't include `0.0.0.0/0` — check
  `<backend-url>/health` for `mongoConnected:false` first to rule this out.
