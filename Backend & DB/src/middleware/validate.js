/**
 * Validation Middleware
 * Uses express-validator for input validation
 *
 * Pattern: define validation rules → run handleValidationErrors
 */

const { body, param, query, validationResult } = require('express-validator');
const { USN_REGEX, BOOK_CONDITIONS } = require('../config/constants');

/**
 * Catches validation errors from express-validator chains
 * Returns 400 with the first error message
 *
 * Usage:
 *   router.post('/route', [...validationRules], handleValidationErrors, controller);
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      message: firstError.msg,
    });
  }

  next();
};

// ─── Seller Verification Rules ──────────────────────────────

const validateSellerVerification = [
  body('usn')
    .trim()
    .notEmpty()
    .withMessage('USN is required')
    .toUpperCase()
    .matches(USN_REGEX)
    .withMessage('Invalid USN format. Expected format: 4SOYYBRXXX (e.g., 4SO24AI042)'),
];

// ─── Pagination Rules ───────────────────────────────────────

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

// ─── ID Parameter Rules ─────────────────────────────────────

const validateIdParam = (paramName) => [
  param(paramName)
    .isInt({ min: 1 })
    .withMessage(`${paramName} must be a positive integer`)
    .toInt(),
];

// ─── Negotiation Rules ──────────────────────────────────────

/**
 * Validates the body for POST /api/negotiations (start a negotiation)
 * Requires: bookId (positive int), offeredPrice (positive number)
 */
const validateCreateNegotiation = [
  body('bookId')
    .notEmpty()
    .withMessage('bookId is required')
    .isInt({ min: 1 })
    .withMessage('bookId must be a positive integer')
    .toInt(),
  body('offeredPrice')
    .notEmpty()
    .withMessage('offeredPrice is required')
    .isFloat({ gt: 0 })
    .withMessage('offeredPrice must be a number greater than zero')
    .toFloat(),
];

/**
 * Validates the body for POST /api/negotiations/:id/offers (place an offer)
 * Requires: offeredPrice (positive number)
 */
const validateCreateOffer = [
  body('offeredPrice')
    .notEmpty()
    .withMessage('offeredPrice is required')
    .isFloat({ gt: 0 })
    .withMessage('offeredPrice must be a number greater than zero')
    .toFloat(),
];

// ─── Message Rules ──────────────────────────────────────────

/**
 * Validates the body for POST /api/messages (send a message)
 * Requires: receiverId (positive int), content (non-empty string)
 * Optional: negotiationId (positive int)
 */
const validateSendMessage = [
  body('receiverId')
    .notEmpty()
    .withMessage('receiverId is required')
    .isInt({ min: 1 })
    .withMessage('receiverId must be a positive integer')
    .toInt(),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content cannot be empty')
    .isLength({ max: 5000 })
    .withMessage('Message content cannot exceed 5000 characters'),
  body('negotiationId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('negotiationId must be a positive integer')
    .toInt(),
];

// ─── Wishlist Rules ─────────────────────────────────────────

/**
 * Validates the body for POST /api/wishlist (add book to wishlist)
 * Requires: bookId (positive int)
 */
const validateAddToWishlist = [
  body('bookId')
    .notEmpty()
    .withMessage('bookId is required')
    .isInt({ min: 1 })
    .withMessage('bookId must be a positive integer')
    .toInt(),
];

// ─── Book Request Rules ──────────────────────────────────────

/**
 * Validates the body for POST /api/requests (create a book request)
 * Requires: title (non-empty string)
 * Optional: author, isbn, category, semester, branch, max_budget, description
 */
const validateCreateRequest = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Book title is required')
    .isLength({ max: 255 })
    .withMessage('Title cannot exceed 255 characters'),
  body('author')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Author cannot exceed 255 characters'),
  body('isbn')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('ISBN cannot exceed 20 characters'),
  body('semester')
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage('Semester must be between 1 and 8')
    .toInt(),
  body('max_budget')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Max budget must be a positive number')
    .toFloat(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
];

/**
 * Validates the body for POST /api/requests/:id/respond (seller responds)
 * Requires: message (non-empty string)
 * Optional: bookId (positive int — linked book listing)
 */
const validateRespondToRequest = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Response message is required')
    .isLength({ max: 2000 })
    .withMessage('Response message cannot exceed 2000 characters'),
  body('bookId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('bookId must be a positive integer')
    .toInt(),
];

// ─── Review Rules ────────────────────────────────────────────

/**
 * Validates the body for POST /api/reviews
 * Requires: transactionId, reviewedUserId, rating (1-5)
 * Optional: comment
 */
const validateCreateReview = [
  body('transactionId')
    .notEmpty()
    .withMessage('transactionId is required')
    .isInt({ min: 1 })
    .withMessage('transactionId must be a positive integer')
    .toInt(),
  body('reviewedUserId')
    .notEmpty()
    .withMessage('reviewedUserId is required')
    .isInt({ min: 1 })
    .withMessage('reviewedUserId must be a positive integer')
    .toInt(),
  body('rating')
    .notEmpty()
    .withMessage('rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('rating must be an integer between 1 and 5')
    .toInt(),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Comment cannot exceed 2000 characters'),
];

// ─── Dispute Rules ───────────────────────────────────────────

/**
 * Validates the body for POST /api/disputes
 * Requires: transactionId (positive int), reason (non-empty string)
 */
const validateRaiseDispute = [
  body('transactionId')
    .notEmpty()
    .withMessage('transactionId is required')
    .isInt({ min: 1 })
    .withMessage('transactionId must be a positive integer')
    .toInt(),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Dispute reason is required')
    .isLength({ max: 2000 })
    .withMessage('Reason cannot exceed 2000 characters'),
];

/**
 * Validates the body for PUT /api/disputes/:id/status (admin only)
 * Requires: status — one of the valid dispute status values
 */
const validateUpdateDisputeStatus = [
  body('status')
    .notEmpty()
    .withMessage('status is required')
    .isIn(['under_review', 'resolved', 'dismissed'])
    .withMessage('status must be one of: under_review, resolved, dismissed'),
];

// ─── Admin Rules ─────────────────────────────────────────────

/**
 * Validates the body for PUT /api/admin/users/:id
 * All fields are optional; at least one must be present (checked in service).
 */
const validateAdminUpdateUser = [
  body('role')
    .optional()
    .isIn(['buyer', 'seller', 'admin'])
    .withMessage('role must be one of: buyer, seller, admin'),
  body('seller_verified')
    .optional()
    .isBoolean()
    .withMessage('seller_verified must be a boolean')
    .toBoolean(),
];

/**
 * Validates the body for PUT /api/admin/transactions/:id/status
 */
const validateAdminUpdateTransactionStatus = [
  body('status')
    .notEmpty()
    .withMessage('status is required')
    .isIn(['completed', 'cancelled'])
    .withMessage('status must be one of: completed, cancelled'),
];

module.exports = {
  handleValidationErrors,
  validateSellerVerification,
  validatePagination,
  validateIdParam,
  validateCreateNegotiation,
  validateCreateOffer,
  validateSendMessage,
  validateAddToWishlist,
  validateCreateRequest,
  validateRespondToRequest,
  validateCreateReview,
  validateRaiseDispute,
  validateUpdateDisputeStatus,
  validateAdminUpdateUser,
  validateAdminUpdateTransactionStatus,
};

