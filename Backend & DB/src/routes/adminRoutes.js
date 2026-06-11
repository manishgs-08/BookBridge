/**
 * Admin Routes
 * Base path: /api/admin
 *
 * ALL routes in this file require:
 * 1. verifyJWT     — valid authentication
 * 2. requireRole('admin') — admin role only
 *
 * The router.use() at the top applies both guards to every route below.
 */

const express = require('express');
const adminController = require('../controllers/adminController');
const { verifyJWT, requireRole } = require('../middleware/auth');
const {
  validateIdParam,
  handleValidationErrors,
  validatePagination,
  validateAdminUpdateUser,
  validateAdminUpdateTransactionStatus,
} = require('../middleware/validate');

const router = express.Router();

// ─── Global Guard — all admin routes require auth + admin role ───────────
router.use(verifyJWT);
router.use(requireRole('admin'));

// ─── Dashboard ──────────────────────────────────────────────────────────────

/**
 * @route   GET /api/admin/dashboard
 * @desc    Platform-wide statistics summary
 */
router.get('/dashboard', adminController.getDashboardStats);

// ─── User Management ────────────────────────────────────────────────────────

/**
 * @route   GET /api/admin/users
 * @desc    List all users with optional role filter, search, and pagination
 * @query   role, search, page, limit
 */
router.get(
  '/users',
  validatePagination,
  handleValidationErrors,
  adminController.listUsers
);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get full profile of a single user
 */
router.get(
  '/users/:id',
  validateIdParam('id'),
  handleValidationErrors,
  adminController.getUserById
);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update a user's role or seller_verified flag
 * @body    { role?, seller_verified? }
 */
router.put(
  '/users/:id',
  validateIdParam('id'),
  validateAdminUpdateUser,
  handleValidationErrors,
  adminController.updateUser
);

// ─── Book Management ─────────────────────────────────────────────────────────

/**
 * @route   GET /api/admin/books
 * @desc    List all book listings (all statuses)
 * @query   status, sellerId, q, page, limit
 */
router.get(
  '/books',
  validatePagination,
  handleValidationErrors,
  adminController.listAllBooks
);

/**
 * @route   DELETE /api/admin/books/:id
 * @desc    Force-remove a book listing
 */
router.delete(
  '/books/:id',
  validateIdParam('id'),
  handleValidationErrors,
  adminController.removeBook
);

// ─── Transaction Management ──────────────────────────────────────────────────

/**
 * @route   GET /api/admin/transactions
 * @desc    List all transactions with optional status filter
 * @query   status, page, limit
 */
router.get(
  '/transactions',
  validatePagination,
  handleValidationErrors,
  adminController.listAllTransactions
);

/**
 * @route   PUT /api/admin/transactions/:id/status
 * @desc    Override a transaction's status
 * @body    { status: 'completed' | 'cancelled' }
 */
router.put(
  '/transactions/:id/status',
  validateIdParam('id'),
  validateAdminUpdateTransactionStatus,
  handleValidationErrors,
  adminController.updateTransactionStatus
);

module.exports = router;
