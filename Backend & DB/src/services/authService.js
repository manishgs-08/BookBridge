/**
 * Authentication Service
 * Business logic for Google OAuth, JWT, and seller verification
 *
 * All database operations use parameterized queries.
 * No password logic — Google OAuth only.
 */

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { SJEC_DOMAIN, USN_REGEX, ROLES } = require('../config/constants');
const AppError = require('../utils/AppError');

/**
 * Generate a JWT access token for the given user
 *
 * Payload: { userId, email, role, sellerVerified }
 * Signed with JWT_SECRET, expires per JWT_EXPIRES_IN
 *
 * @param {Object} user - User record from the database
 * @returns {string} Signed JWT token
 */
const generateJWT = (user) => {
  const payload = {
    userId: user.user_id,
    email: user.email,
    role: user.role,
    sellerVerified: !!user.seller_verified,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'bookbridge',
    subject: String(user.user_id),
  });
};

/**
 * Find a user by their user_id
 *
 * @param {number} userId
 * @returns {Object|null} User record or null
 */
const findUserById = async (userId) => {
  const [users] = await pool.query(
    `SELECT user_id, google_id, user_name, email, email_verified, profile_picture,
            role, seller_verified, usn, created_at, updated_at
     FROM User WHERE user_id = ?`,
    [userId]
  );

  return users.length > 0 ? users[0] : null;
};

/**
 * Find a user by their Google ID
 *
 * @param {string} googleId
 * @returns {Object|null} User record or null
 */
const findUserByGoogleId = async (googleId) => {
  const [users] = await pool.query(
    `SELECT user_id, google_id, user_name, email, email_verified, profile_picture,
            role, seller_verified, usn, created_at, updated_at
     FROM User WHERE google_id = ?`,
    [googleId]
  );

  return users.length > 0 ? users[0] : null;
};

/**
 * Verify that the email belongs to the SJEC domain
 *
 * @param {string} email
 * @returns {boolean}
 */
const verifySjecDomain = (email) => {
  if (!email) return false;

  const domain = email.split('@')[1];
  return domain && domain.toLowerCase() === SJEC_DOMAIN.toLowerCase();
};

/**
 * Validate USN format against VTU/SJEC pattern
 * Format: 4SOYYBRXXX (e.g., 4SO24AI042)
 *
 * @param {string} usn
 * @returns {boolean}
 */
const validateUSNFormat = (usn) => {
  if (!usn) return false;
  return USN_REGEX.test(usn.toUpperCase());
};

/**
 * Process seller verification
 *
 * Steps:
 * 1. Check that Google verified the user's email
 * 2. Validate email domain is @sjec.ac.in
 * 3. Validate USN format (4SOYYBRXXX)
 * 4. Check USN is not already used by another user
 * 5. Update user: role → seller, seller_verified → true, usn → value
 * 6. Return updated user + new JWT
 *
 * No USN-to-email cross-checking (per approved requirement).
 *
 * @param {number} userId
 * @param {string} usn
 * @returns {Object} { user, token }
 */
const verifySeller = async (userId, usn) => {
  // Fetch current user
  const user = await findUserById(userId);

  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Already verified?
  if (user.seller_verified && user.role === ROLES.SELLER) {
    throw AppError.conflict('You are already a verified seller');
  }

  // Step 1: Google email must be verified
  if (!user.email_verified) {
    throw AppError.forbidden(
      'Your Google email must be verified before seller registration'
    );
  }

  // Step 2: Validate SJEC domain
  if (!verifySjecDomain(user.email)) {
    throw AppError.forbidden(
      'Only SJEC students with @sjec.ac.in email can become sellers'
    );
  }

  // Step 3: Validate USN format
  const normalizedUSN = usn.toUpperCase().trim();

  if (!validateUSNFormat(normalizedUSN)) {
    throw AppError.badRequest(
      'Invalid USN format. Expected format: 4SOYYBRXXX (e.g., 4SO24AI042)'
    );
  }

  // Step 4: Check USN uniqueness
  const [existingUSN] = await pool.query(
    'SELECT user_id FROM User WHERE usn = ? AND user_id != ?',
    [normalizedUSN, userId]
  );

  if (existingUSN.length > 0) {
    throw AppError.conflict('This USN is already registered to another account');
  }

  // Step 5: Grant seller role
  await pool.query(
    `UPDATE User 
     SET role = ?, seller_verified = TRUE, usn = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [ROLES.SELLER, normalizedUSN, userId]
  );

  // Step 6: Fetch updated user and generate new JWT
  const updatedUser = await findUserById(userId);
  const token = generateJWT(updatedUser);

  return { user: updatedUser, token };
};

/**
 * Get user profile (excludes sensitive fields)
 *
 * @param {number} userId
 * @returns {Object} Safe user profile
 */
const getUserProfile = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throw AppError.notFound('User not found');
  }

  return user;
};

/**
 * Generate a one-time OAuth exchange code.
 *
 * Stores a cryptographically random 64-char hex code in the AuthCode table,
 * associated with the authenticated user, expiring in 60 seconds.
 * The code is single-use: once exchanged, the `used` flag is set.
 *
 * @param {number} userId
 * @returns {string} The one-time code to embed in the redirect URL
 */
const generateAuthCode = async (userId) => {
  // Purge expired/used codes for this user first (housekeeping)
  await pool.query(
    'DELETE FROM AuthCode WHERE user_id = ? AND (expires_at < NOW() OR used = TRUE)',
    [userId]
  );

  const code      = crypto.randomBytes(32).toString('hex'); // 64-char hex string
  const expiresAt = new Date(Date.now() + 60 * 1000);       // 60 seconds TTL

  await pool.query(
    'INSERT INTO AuthCode (code, user_id, expires_at, used) VALUES (?, ?, ?, FALSE)',
    [code, userId, expiresAt]
  );

  return code;
};

/**
 * Exchange a one-time code for a JWT.
 *
 * Rules enforced:
 * 1. Code must exist in the AuthCode table.
 * 2. Code must not be expired (expires_at > NOW()).
 * 3. Code must not have been used already.
 * 4. After successful exchange, mark `used = TRUE` immediately.
 *
 * @param {string} code - The one-time code submitted by the client
 * @returns {{ token: string, user: Object }} JWT and user profile
 * @throws {AppError} 400 if code is invalid, expired, or already used
 */
const exchangeAuthCode = async (code) => {
  if (!code || typeof code !== 'string' || code.trim() === '') {
    throw AppError.badRequest('Authorization code is required');
  }

  const [rows] = await pool.query(
    `SELECT ac.code_id, ac.user_id, ac.expires_at, ac.used
     FROM AuthCode ac
     WHERE ac.code = ?
     LIMIT 1`,
    [code.trim()]
  );

  if (rows.length === 0) {
    throw AppError.badRequest('Invalid authorization code');
  }

  const authCode = rows[0];

  if (authCode.used) {
    throw AppError.badRequest('This authorization code has already been used');
  }

  if (new Date(authCode.expires_at) < new Date()) {
    // Clean up expired code
    await pool.query('DELETE FROM AuthCode WHERE code_id = ?', [authCode.code_id]);
    throw AppError.badRequest('Authorization code has expired. Please sign in again.');
  }

  // Mark as used BEFORE generating JWT to prevent race-condition double-use
  await pool.query(
    'UPDATE AuthCode SET used = TRUE WHERE code_id = ?',
    [authCode.code_id]
  );

  const user  = await findUserById(authCode.user_id);

  if (!user) {
    throw AppError.unauthorized('User associated with this code no longer exists');
  }

  const token = generateJWT(user);

  return { token, user };
};

module.exports = {

  generateJWT,
  findUserById,
  findUserByGoogleId,
  verifySjecDomain,
  validateUSNFormat,
  verifySeller,
  getUserProfile,
  generateAuthCode,
  exchangeAuthCode,
};

