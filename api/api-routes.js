/**
 * API routes: POST /api/draw (mounted at /api in server.js).
 * POST /api/draw: same draw logic as POST /draw, returns { id, type, title, level, description, imageUrl }.
 */

import express from 'express';
import { draw } from '../draw.js';
import { signToDrawResponse } from './sign-display.js';

const router = express.Router();
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR',
]);

router.post('/draw', async (req, res) => {
  try {
    const result = await draw();
    if (result.status === 'OUT_OF_STOCK') {
      res.status(200).json({ status: 'OUT_OF_STOCK' });
      return;
    }
    const body = signToDrawResponse(result.sign);
    res.status(200).json(body);
  } catch (err) {
    const isConnection = err.code && CONNECTION_ERROR_CODES.has(err.code);
    if (isConnection) {
      res.status(503).json({ error: 'Service Unavailable', message: 'Database unavailable' });
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: 'Draw failed' });
    }
  }
});

export default router;
