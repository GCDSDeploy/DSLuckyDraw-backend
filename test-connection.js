import 'dotenv/config';
import mysql from 'mysql2/promise';

async function testConnection() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
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
