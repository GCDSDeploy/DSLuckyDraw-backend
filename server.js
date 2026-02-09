/**
 * Step 3 — API server. CORS, GET /api/ping, POST /draw, POST /api/draw.
 * No frontend code changes. No schema changes.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { registerDrawRoute } from './api/draw-api.js';
import apiRoutes from './api/api-routes.js';

const app = express();

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean) || [];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json());

app.get('/api/ping', (req, res) => res.json({ msg: 'pong' }));
app.use('/api', apiRoutes);

registerDrawRoute(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Step 3 API listening on http://localhost:${PORT}`);
});
