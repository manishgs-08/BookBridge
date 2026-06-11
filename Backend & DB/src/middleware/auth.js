/**
 * Authentication & Authorization Middleware
 *
 * verifyJWT            — Validates Bearer token, attaches req.user
 * requireRole          — Checks user role against allowed roles
 * requireVerifiedSeller — Ensures user is a verified seller
 */

const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * JWT Verification Middleware
 *
 * Extracts JWT from Authorization header (Bearer <token>)
 * Verifies signature and expiry
 * Fetches fresh user data from DB (ensures banned/deleted users are caught)
 * Attaches user object to req.user
 */
const verifyJWT = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Access token is required');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw AppError.unauthorized('Access token is required');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw AppError.unauthorized('Token has expired');
      }
      if (jwtError.name === 'JsonWebTokenError') {
        throw AppError.unauthorized('Invalid token');
      }
      throw AppError.unauthorized('Token verification failed');
    }

    // Fetch fresh user data from database
    // This ensures deleted/banned users are immediately locked out
    const [users] = await pool.query(
      'SELECT user_id, google_id, user_name, email, email_verified, profile_picture, role, seller_verified, usn, created_at FROM User WHERE user_id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      throw AppError.unauthorized('User no longer exists');
    }

    req.user = users[0];
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-Based Access Control Middleware (factory function)
 *
 * Usage:
 *   router.get('/admin/users', verifyJWT, requireRole('admin'), handler);
 *   router.post('/books', verifyJWT, requireRole('seller', 'admin'), handler);
 *
 * @param  {...string} allowedRoles - Roles permitted to access the route
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        )
      );
    }

    next();
  };
};

/**
 * Verified Seller Middleware
 *
 * Ensures the user:
 * 1. Has the 'seller' role (or 'admin')
 * 2. Has completed seller verification (seller_verified = true)
 *
 * Use on routes that require a verified seller:
 *   router.post('/books', verifyJWT, requireVerifiedSeller, handler);
 */
const requireVerifiedSeller = (req, res, next) => {
  if (!req.user) {
    return next(AppError.unauthorized('Authentication required'));
  }

  // Admins bypass seller verification
  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.role !== 'seller') {
    return next(
      AppError.forbidden('Only verified sellers can access this resource')
    );
  }

  if (!req.user.seller_verified) {
    return next(
      AppError.forbidden('Seller verification is incomplete. Please verify your SJEC credentials.')
    );
  }

  next();
};

module.exports = { verifyJWT, requireRole, requireVerifiedSeller };
