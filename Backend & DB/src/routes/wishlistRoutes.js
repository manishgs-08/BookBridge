/**
 * Wishlist Routes
 * Base path: /api/wishlist
 */

const express = require('express');
const wishlistController = require('../controllers/wishlistController');
const { verifyJWT }      = require('../middleware/auth');
const {
  validateIdParam,
  handleValidationErrors,
  validateAddToWishlist,
} = require('../middleware/validate');

const router = express.Router();

// All wishlist routes require authentication
router.use(verifyJWT);

/**
 * @route   GET /api/wishlist
 * @desc    Get the logged-in user's full wishlist
 * @access  Private
 */
router.get('/', wishlistController.getWishlist);

/**
 * @route   POST /api/wishlist
 * @desc    Add a book to the wishlist
 * @body    { bookId: number }
 * @access  Private
 */
router.post(
  '/',
  validateAddToWishlist,
  handleValidationErrors,
  wishlistController.addToWishlist
);

/**
 * @route   DELETE /api/wishlist/:bookId
 * @desc    Remove a book from the wishlist
 * @access  Private
 */
router.delete(
  '/:bookId',
  validateIdParam('bookId'),
  handleValidationErrors,
  wishlistController.removeFromWishlist
);

module.exports = router;
