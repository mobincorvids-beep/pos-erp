# Deploying to Vercel

This repo deploys as **two separate Vercel projects**, not one:

1. **Backend API** — project root: repo root (`/`)
   - Uses `vercel.json` + `api/index.js`, which wraps the Express app
     (`src/app.js`) as a single serverless function that handles every
     route.
   - Set these environment variables in this Vercel project's dashboard
     (Settings -> Environment Variables):
     - `MONGO_URI` — your MongoDB Atlas connection string
     - `JWT_SECRET` — a strong random secret
     - `JWT_EXPIRES_IN` (optional, e.g. `1h`)
     - `CLIENT_ORIGIN` — comma-separated list of allowed origins, e.g.
       the deployed frontend project's URL
     - any other env vars `src/config/validateEnv.js` requires
   - MongoDB connections are cached across invocations
     (`src/config/db.js`) so this is safe to run serverless without
     exhausting Atlas's connection limit.

2. **Frontend (client)** — project root: `client/`
   - Already has its own `client/vercel.json` (static SPA build).
   - Set `VITE_API_BASE_URL` in this Vercel project's dashboard, pointed
     at the backend project's deployed URL, e.g.
     `https://your-backend-project.vercel.app/api/v1`.

## Notes

- `npm start` / Docker (`docker-compose.yml`, `Dockerfile`) are unaffected
  — they still run `node src/server.js`, which imports the same
  `src/app.js` and does one long-lived `connectDB()` + `app.listen()`.
- No new dependency is needed for the Vercel build — `@vercel/node` is
  provided by the Vercel platform itself, not installed in this repo.
