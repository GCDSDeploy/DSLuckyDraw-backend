/**
 * Step 3 — DB state verification. Uses getConnection() from draw.js.
 * Prints signs row count and temp table status. Closes connection in finally.
 */
import 'dotenv/config';
import { getConnection } from './draw.js';

async function run() {
  const conn = await getConnection();
  try {
    const [rows] = await conn.query('SELECT COUNT(*) AS n FROM signs');
    const [backup] = await conn.query("SHOW TABLES LIKE 'signs_backup'");
    const [test] = await conn.query("SHOW TABLES LIKE 'signs_test'");
    console.log('signs row count:', rows[0].n);
    console.log('signs_backup exists:', backup.length > 0 ? 'yes' : 'no');
    console.log('signs_test exists:', test.length > 0 ? 'yes' : 'no');
  } finally {
    await conn.end();
  }
}
run().catch((e) => { console.error(e); process.exit(1); });
