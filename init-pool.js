import 'dotenv/config';
import mysql from 'mysql2/promise';

const POOL_SPEC = [
  { level: 1, type: 'Top-Top', reward_code: 'R01', count: 40 },
  { level: 2, type: 'Top', reward_code: 'R02', count: 200 },
  { level: 3, type: 'Special', reward_code: 'R03', count: 150 },
  { level: 0, type: 'Empty', reward_code: 'EMPTY', count: 9610 },
];

const BATCH_SIZE = 500;

function signId(levelNumber, runningIndex) {
  const levelStr = String(levelNumber).padStart(2, '0');
  const indexStr = String(runningIndex).padStart(4, '0');
  return `S${levelStr}-${indexStr}`;
}

async function run() {
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_NAME:', process.env.DB_NAME);

  const port = process.env.DB_PORT != null && process.env.DB_PORT !== ''
    ? Number(process.env.DB_PORT)
    : 3306;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Create table if not exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS signs (
        id VARCHAR(10) PRIMARY KEY,
        level INT NOT NULL,
        type VARCHAR(10) NOT NULL,
        reward_code VARCHAR(10) NOT NULL,
        is_drawn BOOLEAN DEFAULT false
      )
    `);

    await conn.execute(`TRUNCATE TABLE signs`);

    // Batch insert (500 per insert)
    for (const spec of POOL_SPEC) {
      const rows = [];
      for (let i = 1; i <= spec.count; i++) {
        rows.push([signId(spec.level, i), spec.level, spec.type, spec.reward_code]);
      }
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const values = batch.flat();
        await conn.execute(
          `INSERT INTO signs (id, level, type, reward_code) VALUES ${placeholders}`,
          values
        );
      }
    }

    // Inline verification
    const expectedTotal = 10000;
    const [totalRows] = await conn.execute('SELECT COUNT(*) AS total FROM signs');
    const total = totalRows[0].total;
    if (total !== expectedTotal) {
      console.error(`Verification failed: total rows ${total} !== ${expectedTotal}`);
      process.exit(1);
    }

    for (const spec of POOL_SPEC) {
      const [levelRows] = await conn.execute(
        'SELECT COUNT(*) AS cnt FROM signs WHERE level = ?',
        [spec.level]
      );
      const cnt = levelRows[0].cnt;
      if (cnt !== spec.count) {
        console.error(`Verification failed: level ${spec.level} count ${cnt} !== ${spec.count}`);
        process.exit(1);
      }
    }

    const [distinctRows] = await conn.execute('SELECT COUNT(DISTINCT id) AS cnt FROM signs');
    const distinctIds = distinctRows[0].cnt;
    if (distinctIds !== expectedTotal) {
      console.error(`Verification failed: distinct IDs ${distinctIds} !== ${expectedTotal}`);
      process.exit(1);
    }

    const [drawnRows] = await conn.execute('SELECT COUNT(*) AS cnt FROM signs WHERE is_drawn = true');
    const drawnCount = drawnRows[0].cnt;
    if (drawnCount !== 0) {
      console.error(`Verification failed: is_drawn count ${drawnCount} !== 0`);
      process.exit(1);
    }

    // Summary
    console.log('--- Summary ---');
    console.log('Total rows:', total);
    console.log('Counts per level:');
    for (const spec of POOL_SPEC) {
      console.log(`  level ${spec.level} (${spec.type}): ${spec.count}`);
    }
    console.log('Distinct IDs:', distinctIds);
    console.log('is_drawn = false count:', total - drawnCount);
    console.log('Step 1: Pool initialization complete ✅');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Step 1 failed:', err);
  process.exit(1);
});
