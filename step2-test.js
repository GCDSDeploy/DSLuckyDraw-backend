/**
 * Step 2 — Mandatory tests. No API, no frontend.
 * 1) Single draw test
 * 2) 10 sequential draws (unique IDs)
 * 3) Stock depletion test (draw until OUT_OF_STOCK, verify)
 * 4) DB integrity verification
 */

import 'dotenv/config';
import { draw, getConnection } from './draw.js';

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('--- Step 2 Tests ---\n');

  const conn = await getConnection();

  async function integrityCheck() {
    const [total] = await conn.query('SELECT COUNT(*) AS n FROM signs');
    const [undrawn] = await conn.query(
      'SELECT COUNT(*) AS n FROM signs WHERE is_drawn = false'
    );
    const [drawn] = await conn.query(
      'SELECT COUNT(*) AS n FROM signs WHERE is_drawn = true'
    );
    return {
      total: total[0].n,
      undrawn: undrawn[0].n,
      drawn: drawn[0].n,
      ok: total[0].n === 10000 && undrawn[0].n + drawn[0].n === 10000,
    };
  }

  try {
    const before = await integrityCheck();
    console.log('Before tests: total=%d undrawn=%d drawn=%d', before.total, before.undrawn, before.drawn);

    // 1) Single draw test
    console.log('\n1) Single draw test');
    const r1 = await draw();
    if (r1.status !== 'OK' || !r1.sign || !r1.sign.id) {
      console.log('   FAIL: expected OK with sign', r1);
      failed++;
    } else {
      console.log('   OK: drew', r1.sign.id, r1.sign.type);
      passed++;
    }

    // 2) 10 sequential draws (unique IDs)
    console.log('\n2) 10 sequential draws (unique IDs)');
    const ids = new Set();
    let dup = false;
    for (let i = 0; i < 10; i++) {
      const r = await draw();
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
      console.log('   OK: 10 unique IDs', [...ids].slice(0, 3).join(', '), '...');
      passed++;
    } else if (!dup) {
      failed++;
    }

    // 3) Stock depletion test
    console.log('\n3) Stock depletion test');
    let draws = 0;
    let last;
    while (true) {
      last = await draw();
      if (last.status === 'OUT_OF_STOCK') break;
      draws++;
    }
    const afterDeplete = await integrityCheck();
    if (afterDeplete.drawn !== 10000 || afterDeplete.undrawn !== 0) {
      console.log('   FAIL: after depletion expected drawn=10000 undrawn=0, got drawn=%d undrawn=%d',
        afterDeplete.drawn, afterDeplete.undrawn);
      failed++;
    } else {
      console.log('   OK: drew until OUT_OF_STOCK; drawn=10000 undrawn=0');
      passed++;
    }

    // 4) DB integrity
    console.log('\n4) DB integrity verification');
    const integrity = await integrityCheck();
    if (!integrity.ok || integrity.total !== 10000) {
      console.log('   FAIL: total=%d drawn+undrawn=%d', integrity.total, integrity.drawn + integrity.undrawn);
      failed++;
    } else {
      console.log('   OK: total=10000 drawn+undrawn=10000');
      passed++;
    }

    console.log('\n--- Result: %d passed, %d failed ---', passed, failed);
    process.exit(failed > 0 ? 1 : 0);
  } finally {
    await conn.end();
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
