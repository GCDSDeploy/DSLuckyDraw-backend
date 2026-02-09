/**
 * Step 3 — API tests. Server must be running (npm run step3:start).
 * 1) Single POST /draw → valid sign
 * 2) 10 sequential POST /draw → unique IDs
 * 3) Deplete → OUT_OF_STOCK
 * 4) DB integrity (drawn + undrawn = 10000)
 */

import 'dotenv/config';
import { getConnection } from './draw.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function postDraw() {
  const res = await fetch(`${BASE}/draw`, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function integrityCheck() {
  const conn = await getConnection();
  try {
    const [total] = await conn.query('SELECT COUNT(*) AS n FROM signs');
    const [undrawn] = await conn.query('SELECT COUNT(*) AS n FROM signs WHERE is_drawn = false');
    const [drawn] = await conn.query('SELECT COUNT(*) AS n FROM signs WHERE is_drawn = true');
    return { total: total[0].n, undrawn: undrawn[0].n, drawn: drawn[0].n };
  } finally {
    await conn.end();
  }
}

async function run() {
  let passed = 0;
  let failed = 0;

  console.log('--- Step 3 API Tests ---\n');
  console.log('Base URL:', BASE);

  try {
    const before = await integrityCheck();
    console.log('Before: total=%d undrawn=%d drawn=%d\n', before.total, before.undrawn, before.drawn);

    // 1) Single draw
    console.log('1) Single POST /draw');
    const r1 = await postDraw();
    if (r1.status !== 200 || !r1.body?.sign?.id) {
      console.log('   FAIL: status=%s body=%j', r1.status, r1.body);
      failed++;
    } else {
      console.log('   OK:', r1.body.sign.id, r1.body.sign.type);
      passed++;
    }

    // 2) 10 sequential, unique IDs
    console.log('\n2) 10 sequential POST /draw (unique IDs)');
    const ids = new Set();
    let dup = false;
    for (let i = 0; i < 10; i++) {
      const r = await postDraw();
      if (r.status !== 200 || r.body?.status === 'OUT_OF_STOCK') {
        console.log('   FAIL: status=%s body=%j', r.status, r.body);
        failed++;
        dup = true;
        break;
      }
      if (!r.body?.sign?.id) {
        console.log('   FAIL: no sign.id', r.body);
        failed++;
        dup = true;
        break;
      }
      if (ids.has(r.body.sign.id)) {
        console.log('   FAIL: duplicate', r.body.sign.id);
        failed++;
        dup = true;
        break;
      }
      ids.add(r.body.sign.id);
    }
    if (!dup && ids.size === 10) {
      console.log('   OK: 10 unique IDs');
      passed++;
    } else if (!dup) failed++;

    // 3) Deplete until OUT_OF_STOCK
    console.log('\n3) Deplete until OUT_OF_STOCK');
    let last;
    let count = 0;
    while (true) {
      last = await postDraw();
      if (last.body?.status === 'OUT_OF_STOCK') break;
      count++;
    }
    const after = await integrityCheck();
    if (after.undrawn !== 0 || after.drawn !== 10000) {
      console.log('   FAIL: expected drawn=10000 undrawn=0, got drawn=%d undrawn=%d', after.drawn, after.undrawn);
      failed++;
    } else {
      console.log('   OK: OUT_OF_STOCK after depletion; drawn=10000 undrawn=0');
      passed++;
    }

    // 4) Integrity
    console.log('\n4) DB integrity');
    const inv = await integrityCheck();
    if (inv.total !== 10000 || inv.drawn + inv.undrawn !== 10000) {
      console.log('   FAIL: total=%d drawn+undrawn=%d', inv.total, inv.drawn + inv.undrawn);
      failed++;
    } else {
      console.log('   OK: total=10000 drawn+undrawn=10000');
      passed++;
    }

    console.log('\n--- Result: %d passed, %d failed ---', passed, failed);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
