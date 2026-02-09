/**
 * Step 3 Lite — API tests with 100 rows only. Tests real POST /draw API.
 * Temporarily swaps signs with a 100-row copy so the API (and draw.js) operate on 100 rows.
 * Server must be running: npm run step3:start (in another terminal).
 *
 * 1) Single POST /draw → valid sign
 * 2) 10 sequential POST /draw → unique IDs
 * 3) Draw until OUT_OF_STOCK (on 100-row pool)
 * 4) DB integrity (total=100, drawn+undrawn, is_drawn flags)
 *
 * Zero risk: original signs table is restored in finally (rename back + drop temp table).
 */

import 'dotenv/config';
import { getConnection } from './draw.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_TABLE = 'signs_test';
const TEST_ROW_LIMIT = 100;

async function postDraw() {
  const res = await fetch(`${BASE}/draw`, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/** Integrity check on current `signs` table (during test this is our 100-row pool). */
async function integrityCheck(conn) {
  const [total] = await conn.query('SELECT COUNT(*) AS n FROM signs');
  const [undrawn] = await conn.query('SELECT COUNT(*) AS n FROM signs WHERE is_drawn = false');
  const [drawn] = await conn.query('SELECT COUNT(*) AS n FROM signs WHERE is_drawn = true');
  return { total: total[0].n, undrawn: undrawn[0].n, drawn: drawn[0].n };
}

async function run() {
  let passed = 0;
  let failed = 0;
  const conn = await getConnection();

  try {
    console.log('--- Step 3 Lite API Tests (100 rows) ---\n');
    console.log('Base URL:', BASE);
    console.log('Server must be running: npm run step3:start\n');

    // Cleanup any leftover tables from previous runs (avoid ER_TABLE_EXISTS_ERROR)
    await conn.execute('DROP TABLE IF EXISTS signs_backup');
    await conn.execute('DROP TABLE IF EXISTS signs_test');

    // --- Setup: create signs_test with 100 rows, then swap with signs ---
    await conn.execute(`
      CREATE TABLE ${TEST_TABLE} (
        id VARCHAR(10) PRIMARY KEY,
        level INT NOT NULL,
        type VARCHAR(10) NOT NULL,
        reward_code VARCHAR(10) NOT NULL,
        is_drawn BOOLEAN DEFAULT false
      )
    `);
    await conn.execute(
      `INSERT INTO ${TEST_TABLE} (id, level, type, reward_code, is_drawn)
       SELECT id, level, type, reward_code, false FROM signs LIMIT ${TEST_ROW_LIMIT}`
    );
    await conn.execute(`UPDATE ${TEST_TABLE} SET is_drawn = false`);

    // Swap: signs (10k) → signs_backup, signs_test (100) → signs. API will now use 100 rows.
    await conn.execute(
      `RENAME TABLE signs TO signs_backup, ${TEST_TABLE} TO signs`
    );
    console.log('Setup: swapped signs with 100-row pool. Original pool in signs_backup.\n');

    const before = await integrityCheck(conn);
    console.log('Before: total=%d undrawn=%d drawn=%d\n', before.total, before.undrawn, before.drawn);

    // --- 1) Single draw returns a valid sign ---
    console.log('1) Single POST /draw');
    const r1 = await postDraw();
    if (r1.status !== 200 || !r1.body?.sign?.id) {
      console.log('   FAIL: status=%s body=%j', r1.status, r1.body);
      failed++;
    } else {
      console.log('   OK:', r1.body.sign.id, r1.body.sign.type, r1.body.sign.reward_code);
      passed++;
    }

    // --- 2) 10 sequential draws return unique IDs ---
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

    // --- 3) Draw until OUT_OF_STOCK on 100-row pool ---
    console.log('\n3) Deplete until OUT_OF_STOCK');
    let last;
    let count = 0;
    while (true) {
      last = await postDraw();
      if (last.body?.status === 'OUT_OF_STOCK') break;
      count++;
    }
    const after = await integrityCheck(conn);
    if (after.undrawn !== 0 || after.drawn !== TEST_ROW_LIMIT) {
      console.log('   FAIL: expected drawn=%d undrawn=0, got drawn=%d undrawn=%d', TEST_ROW_LIMIT, after.drawn, after.undrawn);
      failed++;
    } else {
      console.log('   OK: OUT_OF_STOCK after', count, 'more draws; drawn=%d undrawn=0', after.drawn);
      passed++;
    }

    // --- 4) DB integrity ---
    console.log('\n4) DB integrity');
    const inv = await integrityCheck(conn);
    if (inv.total !== TEST_ROW_LIMIT || inv.drawn + inv.undrawn !== inv.total) {
      console.log('   FAIL: total=%d drawn+undrawn=%d', inv.total, inv.drawn + inv.undrawn);
      failed++;
    } else {
      console.log('   OK: total=%d drawn+undrawn=%d, is_drawn consistent', inv.total, inv.drawn + inv.undrawn);
      passed++;
    }

    console.log('\n--- Result: %d passed, %d failed ---', passed, failed);
  } catch (err) {
    console.error('Step 3 Lite failed:', err);
    process.exit(1);
  } finally {
    // --- Teardown (zero-risk): restore signs if we swapped, always drop signs_test, close connection ---
    try {
      const [backupRows] = await conn.query("SHOW TABLES LIKE 'signs_backup'");
      if (backupRows.length > 0) {
        await conn.execute(`RENAME TABLE signs TO ${TEST_TABLE}, signs_backup TO signs`);
        await conn.execute(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
        console.log('Teardown: original signs table restored. signs_test dropped.');
      } else {
        await conn.execute(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
        console.log('Teardown: signs_test dropped (no swap to restore).');
      }
    } catch (restoreErr) {
      console.error('Teardown failed (restore signs table manually if needed):', restoreErr);
    }
    await conn.end();
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
