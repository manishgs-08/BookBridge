/**
 * Review Controller
 * HTTP handlers for review endpoints.
 */

const reviewService = require('../services/reviewService');
const { success }   = require('../utils/responseHelper');

/**
 * Create a review for a completed transaction
 * @route POST /api/reviews
 * @access Private
 */
const createReview = async (req, res, next) => {
  try {
    const reviewerId = req.user.user_id;
    const { transactionId, reviewedUserId, rating, comment } = req.body;

    const review = await reviewService.createReview(
      reviewerId,
      transactionId,
      reviewedUserId,
      rating,
      comment
    );

    return success(res, 'Review submitted successfully', { review }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get all reviews for a specific user (their profile reviews)
 * @route GET /api/reviews/user/:userId
 * @access Private
 */
const getReviewsForUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const { page, limit } = req.query;

    const result = await reviewService.getReviewsForUser(userId, page, limit);
    return success(res, 'Reviews retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single review by ID
 * @route GET /api/reviews/:id
 * @access Private
 */
const getReview = async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const review   = await reviewService.getReview(reviewId);
    return success(res, 'Review retrieved successfully', { review });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createReview,
  getReviewsForUser,
  getReview,
};
