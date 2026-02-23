import 'dotenv/config';
import mysql from 'mysql2/promise';

async function testConnection() {
  try {
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
    console.log('✅ Database connection successful');
    await conn.end();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }
}

testConnection();
