/**
 * API routes: POST /api/draw (mounted at /api in server.js).
 * v2: 必带 guest_id，无限奖池 + 轮次逻辑，返回 success/won/tier/drawRound/message/guestId/prizeImageUrl。
 */

import express from 'express';
import { drawV2 } from '../draw-v2.js';

const router = express.Router();
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR',
]);

router.post('/draw', async (req, res) => {
  const guestId = req.body?.guest_id ?? req.body?.guestId ?? req.get('x-guest-id');
  if (!guestId || typeof guestId !== 'string' || guestId.trim() === '') {
    res.status(400).json({ success: false, error: 'guest_id is required' });
    return;
  }
  const trimmedGuestId = guestId.trim();
  console.log('[POST /api/draw] guest_id=', trimmedGuestId.slice(0, 8) + '...', 'from', req.get('origin') || req.ip);
  try {
    const result = await drawV2(trimmedGuestId);
    res.status(200).json(result);
  } catch (err) {
    console.error('[POST /api/draw]', err.code || err.message, err.message);
    const isConnection = err.code && CONNECTION_ERROR_CODES.has(err.code);
    if (isConnection) {
      res.status(503).json({ error: 'Service Unavailable', message: 'Database unavailable' });
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: 'Draw failed' });
    }
  }
});

export default router;
