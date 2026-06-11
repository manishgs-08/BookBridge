/**
 * Review Routes
 * Base path: /api/reviews
 *
 * Note: /user/:userId is declared before /:id to prevent Express
 * treating "user" as a numeric review ID.
 */

const express = require('express');
const reviewController = require('../controllers/reviewController');
const { verifyJWT }    = require('../middleware/auth');
const {
  validateIdParam,
  handleValidationErrors,
  validateCreateReview,
  validatePagination,
} = require('../middleware/validate');

const router = express.Router();

// All review routes require authentication
router.use(verifyJWT);

/**
 * @route   GET /api/reviews/user/:userId
 * @desc    Get all reviews written about a specific user
 * @access  Private
 */
router.get(
  '/user/:userId',
  validateIdParam('userId'),
  validatePagination,
  handleValidationErrors,
  reviewController.getReviewsForUser
);

/**
 * @route   POST /api/reviews
 * @desc    Submit a review for a completed transaction
 * @body    { transactionId, reviewedUserId, rating, comment? }
 * @access  Private
 */
router.post(
  '/',
  validateCreateReview,
  handleValidationErrors,
  reviewController.createReview
);

/**
 * @route   GET /api/reviews/:id
 * @desc    Get a single review by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateIdParam('id'),
  handleValidationErrors,
  reviewController.getReview
);

module.exports = router;
