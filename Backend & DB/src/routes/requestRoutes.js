/**
 * Request Routes
 * Base path: /api/requests
 *
 * Note: specific sub-paths (/:id/respond) come AFTER /:id routes,
 * but before any would-be wildcard conflicts. Express matches first-declared wins.
 */

const express = require('express');
const requestController    = require('../controllers/requestController');
const { verifyJWT, requireVerifiedSeller } = require('../middleware/auth');
const {
  validateIdParam,
  handleValidationErrors,
  validateCreateRequest,
  validateRespondToRequest,
  validatePagination,
} = require('../middleware/validate');

const router = express.Router();

// All request routes require authentication
router.use(verifyJWT);

/**
 * @route   GET /api/requests
 * @desc    List all book requests with optional filters and pagination
 * @query   q, category, semester, branch, status, page, limit
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  handleValidationErrors,
  requestController.getRequests
);

/**
 * @route   POST /api/requests
 * @desc    Create a new book request
 * @body    { title, author?, isbn?, category?, semester?, branch?, max_budget?, description? }
 * @access  Private
 */
router.post(
  '/',
  validateCreateRequest,
  handleValidationErrors,
  requestController.createRequest
);

/**
 * @route   GET /api/requests/:id
 * @desc    Get a single book request with all seller responses
 * @access  Private
 */
router.get(
  '/:id',
  validateIdParam('id'),
  handleValidationErrors,
  requestController.getRequestDetails
);

/**
 * @route   PUT /api/requests/:id
 * @desc    Update a book request (owner only)
 * @access  Private
 */
router.put(
  '/:id',
  validateIdParam('id'),
  handleValidationErrors,
  requestController.updateRequest
);

/**
 * @route   DELETE /api/requests/:id
 * @desc    Delete a book request (owner only)
 * @access  Private
 */
router.delete(
  '/:id',
  validateIdParam('id'),
  handleValidationErrors,
  requestController.deleteRequest
);

/**
 * @route   POST /api/requests/:id/respond
 * @desc    Seller responds to a book request
 * @body    { message: string, bookId?: number }
 * @access  Private (verified sellers only)
 */
router.post(
  '/:id/respond',
  requireVerifiedSeller,
  validateIdParam('id'),
  validateRespondToRequest,
  handleValidationErrors,
  requestController.respondToRequest
);

module.exports = router;
