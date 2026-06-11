/**
 * Environment Variable Validation
 *
 * Called once at server startup BEFORE any other initialization.
 * Throws immediately with a clear message if required variables are missing.
 * This prevents the server from starting in a broken configuration.
 */

'use strict';

/**
 * Required environment variables and their descriptions.
 * DATABASE_URL is optional — if present it overrides the individual DB_* vars.
 * All others are mandatory.
 */
const REQUIRED_VARS = [
  // Database (individual vars — required unless DATABASE_URL is set)
  { key: 'DB_HOST',     group: 'database',       description: 'MySQL host' },
  { key: 'DB_PORT',     group: 'database',       description: 'MySQL port' },
  { key: 'DB_USER',     group: 'database',       description: 'MySQL username' },
  { key: 'DB_PASSWORD', group: 'database',       description: 'MySQL password' },
  { key: 'DB_NAME',     group: 'database',       description: 'MySQL database name' },

  // JWT
  { key: 'JWT_SECRET',     group: 'jwt', description: 'JWT signing secret (min 32 chars recommended)' },
  { key: 'JWT_EXPIRES_IN', group: 'jwt', description: 'JWT expiry duration (e.g. 7d)' },

  // Google OAuth
  { key: 'GOOGLE_CLIENT_ID',     group: 'oauth', description: 'Google OAuth 2.0 Client ID' },
  { key: 'GOOGLE_CLIENT_SECRET', group: 'oauth', description: 'Google OAuth 2.0 Client Secret' },

  // Application
  { key: 'FRONTEND_URL', group: 'app', description: 'Frontend origin URL (for CORS and OAuth redirect)' },
];

/**
 * Validate all required environment variables.
 * If DATABASE_URL is set, the individual DB_* vars are not required.
 *
 * @throws {Error} if any required variable is missing or JWT_SECRET is too short
 */
const validateEnv = () => {
  const missing = [];
  const warnings = [];

  const hasConnectionString = Boolean(process.env.DATABASE_URL);

  for (const { key, group, description } of REQUIRED_VARS) {
    // Skip individual DB vars when DATABASE_URL is provided
    if (group === 'database' && hasConnectionString) {
      continue;
    }

    const value = process.env[key];

    if (!value || value.trim() === '') {
      missing.push(`  • ${key}: ${description}`);
    }
  }

  // JWT_SECRET strength check (non-empty is enforced above; length is a warning)
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push(
      `  ⚠  JWT_SECRET is only ${jwtSecret.length} characters. Minimum 32 characters strongly recommended for security.`
    );
  }

  // NODE_ENV default warning
  if (!process.env.NODE_ENV) {
    warnings.push('  ⚠  NODE_ENV is not set. Defaulting to development behaviour.');
  }

  // Print warnings (non-fatal)
  if (warnings.length > 0) {
    console.warn('\n⚠  BookBridge — Environment Warnings:');
    warnings.forEach(w => console.warn(w));
    console.warn('');
  }

  // Fatal: missing required variables
  if (missing.length > 0) {
    const message = [
      '\n❌ BookBridge — FATAL: Missing required environment variables:',
      ...missing,
      '\nPlease set these variables in your .env file or deployment environment.',
      'The server cannot start with an incomplete configuration.\n',
    ].join('\n');

    throw new Error(message);
  }
};

module.exports = { validateEnv };
