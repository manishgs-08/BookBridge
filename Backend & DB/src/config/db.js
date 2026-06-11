/**
 * MySQL Connection Pool Configuration
 * Uses mysql2/promise for async/await support
 *
 * Connection pool reuses connections efficiently.
 * All queries should use parameterized statements to prevent SQL injection.
 *
 * Supports both individual env vars (DB_HOST, DB_PORT, etc.)
 * and a single DATABASE_URL connection string (provided by Railway).
 */

const mysql = require('mysql2/promise');

// Railway provides a DATABASE_URL — parse it if available
let poolConfig;

if (process.env.DATABASE_URL) {
  // Parse the connection string: mysql://user:pass@host:port/dbname
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

const pool = mysql.createPool({
  ...poolConfig,

  // SSL — required for Railway (and most cloud MySQL providers)
  ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined,

  // Pool settings
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,     // 60 seconds
  queueLimit: 0,          // Unlimited queue

  // Timezone
  timezone: '+00:00',

  // Return dates as strings to avoid timezone conversion issues
  dateStrings: true,
});

/**
 * Test database connectivity
 * Call this on server startup to fail fast if MySQL is unavailable
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    console.log('✅ MySQL connected successfully');
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
};

/**
 * Gracefully close all pool connections
 * Call this on server shutdown (SIGTERM/SIGINT)
 */
const closePool = async () => {
  try {
    await pool.end();
    console.log('MySQL pool closed');
  } catch (err) {
    console.error('Error closing MySQL pool:', err.message);
  }
};

module.exports = { pool, testConnection, closePool };
