const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { verifyJWT } = require('../middleware/auth');
const {
  validateSellerVerification,
  handleValidationErrors,
} = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth 2.0 flow
 * @access  Public
 */
router.get(
  '/google',
  authLimiter,
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth 2.0 callback URL
 * @access  Public
 */
router.get(
  '/google/callback',
  authLimiter,
  (req, res, next) => {
    passport.authenticate('google', {
      failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`,
      session: false,
    })(req, res, next);
  },
  authController.googleCallback
);

/**
 * @route   POST /api/auth/exchange
 * @desc    Exchange one-time auth code for JWT
 * @access  Public
 */
router.post('/exchange', authLimiter, authController.exchangeAuthCode);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private (JWT Required)
 */
router.get('/me', verifyJWT, authController.getMe);

/**
 * @route   POST /api/auth/verify-seller
 * @desc    Verify seller eligibility with USN
 * @access  Private (JWT Required)
 */
router.post(
  '/verify-seller',
  authLimiter,
  verifyJWT,
  validateSellerVerification,
  handleValidationErrors,
  authController.verifySeller
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side action, server responds success)
 * @access  Private (JWT Required)
 */
router.post('/logout', verifyJWT, authController.logout);

module.exports = router;
