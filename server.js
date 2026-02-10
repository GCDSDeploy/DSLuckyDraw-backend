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

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return callback(null, true);
  } catch (_) {}
  if (corsOrigins.includes(origin)) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
}
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());

// 根路径：避免浏览器/扩展访问 http://localhost:3000/ 时出现 404
app.get('/', (req, res) => res.json({ ok: true, service: 'dsluckydraw-backend' }));
// Chrome DevTools 会请求此 URL，返回空 JSON 避免 404 和控制台报错
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.json({}));
app.get('/api/ping', (req, res) => res.json({ msg: 'pong' }));
app.use('/api', apiRoutes);

registerDrawRoute(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Step 3 API listening on http://localhost:${PORT}`);
});
