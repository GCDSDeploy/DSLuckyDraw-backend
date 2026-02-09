/**
 * Step 2 — Lightweight test (100 rows). Validates draw.js logic without modifying draw.js.
 * Uses a temporary table 'signs_test' so the original 10,000-row 'signs' pool stays untouched.
 * Mirrors draw.js algorithm (COUNT → random OFFSET → SELECT FOR UPDATE → UPDATE is_drawn) against signs_test.
 */

import 'dotenv/config';
import { getConnection } from './draw.js';

const TEST_TABLE = 'signs_test';
const TEST_ROW_LIMIT = 100;

/**
 * Same algorithm as draw.js but operates on signs_test. Uses existing connection.
 * @param { import('mysql2/promise').Connection } conn
 * @returns { Promise<{ status: 'OK', sign: { id, level, type, reward_code } } | { status: 'OUT_OF_STOCK' }> }
 */
async function drawFromTestTable(conn) {
  async function attempt() {
    await conn.beginTransaction();
    try {
      const [countRows] = await conn.query(
        `SELECT COUNT(*) AS n FROM ${TEST_TABLE} WHERE is_drawn = false`
      );
      const n = countRows[0].n;
      if (n === 0) {
        await conn.rollback();
        return { status: 'OUT_OF_STOCK' };
      }

      const offset = Math.floor(Math.random() * n);

      const [rows] = await conn.query(
        `SELECT id, level, type, reward_code FROM ${TEST_TABLE} WHERE is_drawn = false ORDER BY id LIMIT 1 OFFSET ? FOR UPDATE`,
        [offset]
      );
      if (!rows || rows.length === 0) {
        await conn.rollback();
        return { status: 'OUT_OF_STOCK' };
      }

      const sign = {
        id: rows[0].id,
        level: rows[0].level,
        type: rows[0].type,
        reward_code: rows[0].reward_code,
      };

      const [result] = await conn.query(
        `UPDATE ${TEST_TABLE} SET is_drawn = true WHERE id = ? AND is_drawn = false`,
        [sign.id]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return null;
      }

      await conn.commit();
      return { status: 'OK', sign };
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  }

  let out = await attempt();
  if (out === null) {
    out = await attempt();
  }
  if (out === null) {
    out = { status: 'OUT_OF_STOCK' };
  }
  return out;
}

/**
 * Integrity check for signs_test: total, undrawn, drawn, and consistency.
 */
async function integrityCheck(conn) {
  const [total] = await conn.query(`SELECT COUNT(*) AS n FROM ${TEST_TABLE}`);
  const [undrawn] = await conn.query(
    `SELECT COUNT(*) AS n FROM ${TEST_TABLE} WHERE is_drawn = false`
  );
  const [drawn] = await conn.query(
    `SELECT COUNT(*) AS n FROM ${TEST_TABLE} WHERE is_drawn = true`
  );
  return {
    total: total[0].n,
    undrawn: undrawn[0].n,
    drawn: drawn[0].n,
    ok: total[0].n === TEST_ROW_LIMIT && undrawn[0].n + drawn[0].n === total[0].n,
  };
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Use same DB connection as draw.js (getConnection from .env)
  const conn = await getConnection();

  try {
    console.log('--- Step 2 Lite Tests (100 rows, table: signs_test) ---\n');

    // --- Setup: create signs_test and copy 100 rows from signs (original pool untouched) ---
    await conn.execute(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
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
    // Ensure all 100 rows are undrawn for predictable depletion test
    await conn.execute(`UPDATE ${TEST_TABLE} SET is_drawn = false`);

    const [count] = await conn.query(`SELECT COUNT(*) AS n FROM ${TEST_TABLE}`);
    console.log(`Setup: signs_test has ${count[0].n} rows (copied from signs). Original signs table unchanged.\n`);

    const before = await integrityCheck(conn);
    console.log('Before tests: total=%d undrawn=%d drawn=%d\n', before.total, before.undrawn, before.drawn);

    // --- Test 1: Single draw returns a valid sign ---
    console.log('1) Single draw test');
    const r1 = await drawFromTestTable(conn);
    if (r1.status !== 'OK' || !r1.sign || !r1.sign.id) {
      console.log('   FAIL: expected OK with sign', r1);
      failed++;
    } else {
      console.log('   OK: drew', r1.sign.id, r1.sign.type, r1.sign.reward_code);
      passed++;
    }

    // --- Test 2: 10 sequential draws return unique IDs ---
    console.log('\n2) 10 sequential draws (unique IDs)');
    const ids = new Set();
    let dup = false;
    for (let i = 0; i < 10; i++) {
      const r = await drawFromTestTable(conn);
      if (r.status !== 'OK') {
        console.log('   FAIL: draw returned', r.status);
        failed++;
        dup = true;
        break;
      }
      if (ids.has(r.sign.id)) {
        console.log('   FAIL: duplicate id', r.sign.id);
        failed++;
        dup = true;
        break;
      }
      ids.add(r.sign.id);
    }
    if (!dup && ids.size === 10) {
      console.log('   OK: 10 unique IDs', [...ids].slice(0, 5).join(', '), '...');
      passed++;
    } else if (!dup) {
      failed++;
    }

    // --- Test 3: Stock depletion returns OUT_OF_STOCK ---
    console.log('\n3) Stock depletion test');
    let draws = 0;
    let last;
    while (true) {
      last = await drawFromTestTable(conn);
      if (last.status === 'OUT_OF_STOCK') break;
      draws++;
    }
    console.log('   Drew', draws, 'more until OUT_OF_STOCK. Last status:', last.status);
    const afterDeplete = await integrityCheck(conn);
    if (afterDeplete.drawn !== TEST_ROW_LIMIT || afterDeplete.undrawn !== 0) {
      console.log('   FAIL: after depletion expected drawn=%d undrawn=0, got drawn=%d undrawn=%d',
        TEST_ROW_LIMIT, afterDeplete.drawn, afterDeplete.undrawn);
      failed++;
    } else {
      console.log('   OK: drawn=' + afterDeplete.drawn + ' undrawn=0, OUT_OF_STOCK confirmed');
      passed++;
    }

    // --- Test 4: Database integrity and is_drawn flags ---
    console.log('\n4) DB integrity verification (signs_test)');
    const integrity = await integrityCheck(conn);
    if (!integrity.ok || integrity.total !== TEST_ROW_LIMIT) {
      console.log('   FAIL: total=%d drawn+undrawn=%d', integrity.total, integrity.drawn + integrity.undrawn);
      failed++;
    } else {
      console.log('   OK: total=%d drawn+undrawn=%d, is_drawn flags consistent', integrity.total, integrity.drawn + integrity.undrawn);
      passed++;
    }

    console.log('\n--- Result: %d passed, %d failed ---', passed, failed);

    // --- Teardown: drop test table (optional; keeps DB clean) ---
    await conn.execute(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
    console.log('Teardown: signs_test dropped. Original signs table untouched.');
  } catch (err) {
    console.error('Step 2 Lite failed:', err);
    // Best-effort cleanup
    try {
      await conn.execute(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
    } catch (_) {}
    process.exit(1);
  } finally {
    await conn.end();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
