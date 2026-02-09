/**
 * Step 3 — API server. CORS, GET /api/ping, POST /draw, POST /api/draw.
 * No frontend code changes. No schema changes.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { registerDrawRoute } from './api/draw-api.js';
import { registerApiRoutes } from './api/api-routes.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean) : []),
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());

app.get('/api/ping', (req, res) => res.json({ msg: 'pong' }));

registerDrawRoute(app);
registerApiRoutes(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Step 3 API listening on http://localhost:${PORT}`);
});
