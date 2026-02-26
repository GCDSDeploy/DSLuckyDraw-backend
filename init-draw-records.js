/**
 * 一次性脚本：创建 draw_records 表（无限奖池 + 轮次记录）
 * 双环境（Railway / CloudBase）表结构一致，各自执行本脚本即可。
 *
 * 连接哪个库由 .env 的 DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME 决定。
 * 本地要建到 luckydraw：请设置 DB_NAME=luckydraw。
 *
 * 字段：id, guest_id, draw_round, won, tier, prizeImageUrl, created_at, round_index(可选)
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run() {
  const dbName = process.env.DB_NAME || 'luckydraw';
  const port = process.env.DB_PORT != null && process.env.DB_PORT !== ''
    ? Number(process.env.DB_PORT)
    : 3306;

  console.log('即将连接数据库:', dbName, '(来自 DB_NAME 或默认 luckydraw)');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
  });
  console.log('当前连接数据库:', conn.config.database);

  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS draw_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guest_id VARCHAR(64) NOT NULL,
        draw_round TINYINT NOT NULL COMMENT '1=第1次 2=第2次',
        won BOOLEAN NOT NULL,
        tier VARCHAR(32) NULL COMMENT '阳光普照/上签/上上签/特签，未中签为NULL',
        prizeImageUrl VARCHAR(512) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        round_index INT NULL COMMENT '第N轮，第2次结束时+1'
      )
    `);
    try {
      await conn.execute(`
        CREATE INDEX idx_draw_records_guest_created ON draw_records (guest_id, created_at DESC)
      `);
    } catch (idxErr) {
      const isDupKey = idxErr.code === 'ER_DUP_KEYNAME' || idxErr.errno === 1061 ||
        (idxErr.message && String(idxErr.message).includes('Duplicate key name'));
      if (isDupKey) {
        console.log('索引 idx_draw_records_guest_created 已存在，跳过创建');
      } else {
        throw idxErr;
      }
    }
    console.log('draw_records 表与索引已就绪。');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
