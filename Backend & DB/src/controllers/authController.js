/**
 * Authentication Controller
 * Handles HTTP requests for auth endpoints
 */

const authService = require('../services/authService');
const { success } = require('../utils/responseHelper');

/**
 * Handle Google OAuth callback
 * Generates Auth Code and redirects to frontend with code
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const googleCallback = async (req, res, next) => {
  try {
    // req.user is set by Passport's Google Strategy
    const user = req.user;

    // Generate a single-use code instead of JWT
    const code = await authService.generateAuthCode(user.user_id);

    // Redirect to frontend with code as a query parameter
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
  } catch (err) {
    next(err);
  }
};

/**
 * Exchange one-time auth code for a JWT
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const exchangeAuthCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    const { token, user } = await authService.exchangeAuthCode(code);
    return success(res, 'Authentication successful', { token, user });
  } catch (err) {
    next(err);
  }
};

/**
 * Get the current authenticated user's profile
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is set by verifyJWT middleware
    const userId = req.user.user_id;
    const profile = await authService.getUserProfile(userId);

    return success(res, 'Profile retrieved successfully', profile);
  } catch (err) {
    next(err);
  }
};

/**
 * Handle seller verification (USN submission)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const verifySeller = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { usn } = req.body;

    const { user, token } = await authService.verifySeller(userId, usn);

    return success(res, 'Seller verification successful', { user, token });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout (Client-side token discard)
 * The server doesn't maintain state, so logout is mostly handled by the client
 * deleting the token. We provide this endpoint for completeness or future
 * token blacklisting implementation.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const logout = (req, res) => {
  // In a stateless JWT setup, the client simply deletes the token.
  // We respond with success.
  return success(res, 'Logged out successfully');
};

module.exports = {
  googleCallback,
  exchangeAuthCode,
  getMe,
  verifySeller,
  logout,
};
