/**
 * Wishlist Controller
 * HTTP handlers for wishlist endpoints.
 */

const wishlistService = require('../services/wishlistService');
const { success }     = require('../utils/responseHelper');

/**
 * Add a book to the wishlist
 * @route POST /api/wishlist
 * @access Private
 */
const addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { bookId } = req.body;

    const entry = await wishlistService.addToWishlist(userId, bookId);
    return success(res, 'Book added to wishlist', { entry }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get current user's full wishlist
 * @route GET /api/wishlist
 * @access Private
 */
const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const wishlist = await wishlistService.getWishlist(userId);
    return success(res, 'Wishlist retrieved successfully', { wishlist });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove a book from the wishlist
 * @route DELETE /api/wishlist/:bookId
 * @access Private
 */
const removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const bookId = req.params.bookId;

    const result = await wishlistService.removeFromWishlist(userId, bookId);
    return success(res, result.message);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
};
