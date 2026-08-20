require('dotenv').config();

// Deliberately NOT calling validateEnv() here. This module's only job is
// to build and export the configured Express app — requiring it (e.g. a
// require-walk sanity check, or a future test importing the app without
// booting a real server) must be a pure, side-effect-free operation.
// validateEnv() calls process.exit(1) on a bad config, which would kill
// whatever process merely required this file, even if that process had no
// intention of ever handling a real request. Entrypoints that actually
// serve traffic (server.js for npm start/Docker, api/index.js for Vercel)
// call validateEnv() themselves, before requiring anything that needs a
// working JWT_SECRET/MONGO_URI.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const routes = require('./routes');
const { generalLimiter } = require('./middleware/rateLimit');

const app = express();

// Required when running behind a reverse proxy / load balancer (Nginx,
// an ELB, Cloudflare) — without it, express-rate-limit and anything else
// keying off req.ip sees the proxy's IP for every request instead of the
// real client's, making per-IP limits meaningless. Harmless when there's
// no proxy (the app just trusts its own direct connection info instead).
app.set('trust proxy', 1);

app.use(helmet());

// CORS is restricted to an explicit allowlist, not wide open — a POS/ERP
// handling real money and customer data should never accept requests from
// an arbitrary origin. Set CLIENT_ORIGIN to a comma-separated list in
// production (e.g. your deployed client's domain + the admin subdomain);
// falling back to the local Vite dev server so `npm run dev` still works
// out of the box without extra setup.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // requests with no Origin header (curl, server-to-server, the
    // e-commerce webhook caller) are allowed through — CORS is a
    // browser-enforced protection, not a substitute for the webhook-token
    // auth those routes already require.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS.'));
  },
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' })); // explicit rather than relying on express's default — generous enough for any real payload here (largest is a GRN/PO with many line items), small enough to blunt a body-based DoS attempt

// Strips any request key starting with `$` or containing `.` from
// body/query/params before it ever reaches a controller — the standard
// defense against NoSQL injection (e.g. a login payload like
// { email: { "$gt": "" }, password: { "$gt": "" } } that would otherwise
// match every document instead of none). Applied globally since every
// route eventually touches Mongoose.
app.use(mongoSanitize());

// Blocks HTTP parameter pollution (e.g. ?status=paid&status[$ne]=paid on a
// query string) from producing an array/object where a controller expects
// a plain string, which could otherwise slip past a naive filter.
app.use(hpp());

app.use('/api/v1', generalLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', mongoConnected: require('mongoose').connection.readyState === 1 }));
app.use('/api/v1', routes);

// Every unmatched route gets the same JSON shape as every other error in
// this API — an Express default 404 is an HTML page, which is exactly the
// wrong response for a JSON API's client to receive and try to parse.
app.use((req, res) => {
  res.status(404).json({ error: `No route matches ${req.method} ${req.originalUrl}.` });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.message === 'Not allowed by CORS.') {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
