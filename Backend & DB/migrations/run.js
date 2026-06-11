require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs/promises');
const path = require('path');

async function runMigrations() {
  console.log('Connecting to database...');
  let poolConfig;

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port, 10) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.replace('/', ''),
    };
  } else {
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'bookbridge',
    };
  }

  const connection = await mysql.createConnection({
    ...poolConfig,
    multipleStatements: true, // Needed to execute multiple statements in one query
    ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true' || process.env.DATABASE_URL?.includes('rlwy.net')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const files = [
    '001_initial_schema.sql',
    '002_phase4_additions.sql',
    '003_auth_code.sql',
    '004_notification_type.sql',
  ];

  for (const file of files) {
    console.log(`Executing ${file}...`);
    const filePath = path.join(__dirname, file);
    const sql = await fs.readFile(filePath, 'utf8');
    await connection.query(sql);
    console.log(`✅ ${file} applied successfully.`);
  }

  await connection.end();
  console.log('All migrations applied successfully.');
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
