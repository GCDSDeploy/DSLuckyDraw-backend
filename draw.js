/**
 * Step 2 — Draw algorithm only. No API, no frontend.
 * Pre-generated pool: COUNT → random OFFSET → SELECT FOR UPDATE → UPDATE is_drawn.
 * Transaction + row lock. Retry once if UPDATE affects 0 rows.
 * Returns { status, sign? } where sign = { id, level, type, reward_code } or OUT_OF_STOCK.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

/**
 * Returns a new MySQL connection using env vars. Use for all Step 2 operations.
 * @returns { Promise<import('mysql2/promise').Connection> }
 */
export async function getConnection() {
  const port = process.env.DB_PORT != null && process.env.DB_PORT !== ''
    ? Number(process.env.DB_PORT)
    : 3306;
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

/**
 * Perform one draw. Uses its own connection and transaction.
 * @returns { Promise<{ status: 'OK', sign: { id, level, type, reward_code } } | { status: 'OUT_OF_STOCK' }> }
 */
async function draw() {
  const conn = await getConnection();

  async function attempt() {
    await conn.beginTransaction();
    try {
      const [countRows] = await conn.query(
        'SELECT COUNT(*) AS n FROM signs WHERE is_drawn = false'
      );
      const n = countRows[0].n;
      if (n === 0) {
        await conn.rollback();
        return { status: 'OUT_OF_STOCK' };
      }

      const offset = Math.floor(Math.random() * n);

      const [rows] = await conn.query(
        `SELECT id, level, type, reward_code FROM signs WHERE is_drawn = false ORDER BY id LIMIT 1 OFFSET ? FOR UPDATE`,
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
        'UPDATE signs SET is_drawn = true WHERE id = ? AND is_drawn = false',
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

  try {
    let out = await attempt();
    if (out === null) {
      out = await attempt();
    }
    if (out === null) {
      out = { status: 'OUT_OF_STOCK' };
    }
    return out;
  } finally {
    await conn.end();
  }
}

export { draw };
