/**
 * Step 3 — API server. CORS, GET /api/ping, POST /draw, POST /api/draw.
 * No frontend code changes. No schema changes.
 */

import 'dotenv/config';
import os from 'os';
import express from 'express';
import cors from 'cors';
import { registerDrawRoute } from './api/draw-api.js';
import apiRoutes from './api/api-routes.js';

function getLanIps() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

const app = express();

const isDev = process.env.NODE_ENV !== 'production';

const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.71.5:5173',
];

// Production CORS: always allow both Vercel frontends; optional CORS_ORIGIN adds more
const vercelOrigins = [
  'https://2026luck.vercel.app',
  'https://2026luck-git-staging-gcdsdeploys-projects.vercel.app',
];
const extraOrigins = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
const prodOrigins = [...new Set([...vercelOrigins, ...extraOrigins])];

const allowedOrigins = isDev ? devOrigins : prodOrigins;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.error('Blocked by CORS:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
// 预检 OPTIONS 必须与主 CORS 一致，否则手机端 POST 会报 Load failed
app.options('*', cors(corsOptions));

app.use(express.json());

// 根路径：避免浏览器/扩展访问 http://localhost:3000/ 时出现 404
app.get('/', (req, res) => res.json({ ok: true, service: 'dsluckydraw-backend' }));
// Chrome DevTools 会请求此 URL，返回空 JSON 避免 404 和控制台报错
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.json({}));
app.get('/api/ping', (req, res) => res.json({ msg: 'pong' }));

app.use('/api', apiRoutes);

registerDrawRoute(app);

// 健康检查：所有中间件与业务路由之后、404 之前，仅 GET /health，返回 200 + JSON
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

const PORT = process.env.PORT || 3000;
const host = isDev ? '0.0.0.0' : undefined; // 开发环境监听所有网卡，便于手机同 WiFi 访问
app.listen(PORT, host, () => {
  console.log(`Step 3 API listening on http://localhost:${PORT}`);
  if (host) {
    const lan = getLanIps();
    if (lan.length) {
      console.log('  LAN (e.g. from phone):');
      lan.forEach((ip) => console.log(`    http://${ip}:${PORT}/api/ping`));
      console.log('  If phone gets "Load failed", allow incoming connections for Node (macOS: 系统设置 → 网络 → 防火墙).');
    }
  }
});
