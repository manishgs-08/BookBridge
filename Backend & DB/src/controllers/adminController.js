/**
 * Admin Controller
 * HTTP handlers for all admin-only endpoints.
 */

const adminService = require('../services/adminService');
const { success }  = require('../utils/responseHelper');

// ─── Dashboard ─────────────────────────────────────────────────────────────

/**
 * Get platform statistics dashboard
 * @route GET /api/admin/dashboard
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    return success(res, 'Dashboard statistics retrieved', { stats });
  } catch (err) {
    next(err);
  }
};

// ─── User Management ────────────────────────────────────────────────────────

/**
 * List all users
 * @route GET /api/admin/users
 */
const listUsers = async (req, res, next) => {
  try {
    const filters = req.query;
    const result  = await adminService.listUsers(filters);
    return success(res, 'Users retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single user by ID
 * @route GET /api/admin/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user   = await adminService.getUserById(userId);
    return success(res, 'User retrieved successfully', { user });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a user's role or verification status
 * @route PUT /api/admin/users/:id
 */
const updateUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const adminId      = req.user.user_id;
    const updateData   = req.body;

    const user = await adminService.updateUser(targetUserId, adminId, updateData);
    return success(res, 'User updated successfully', { user });
  } catch (err) {
    next(err);
  }
};

// ─── Book Management ─────────────────────────────────────────────────────────

/**
 * List all book listings (all statuses)
 * @route GET /api/admin/books
 */
const listAllBooks = async (req, res, next) => {
  try {
    const filters = req.query;
    const result  = await adminService.listAllBooks(filters);
    return success(res, 'Books retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Force-remove a book listing
 * @route DELETE /api/admin/books/:id
 */
const removeBook = async (req, res, next) => {
  try {
    const bookId = req.params.id;
    const result = await adminService.removeBook(bookId);
    return success(res, result.message);
  } catch (err) {
    next(err);
  }
};

// ─── Transaction Management ──────────────────────────────────────────────────

/**
 * List all transactions
 * @route GET /api/admin/transactions
 */
const listAllTransactions = async (req, res, next) => {
  try {
    const filters = req.query;
    const result  = await adminService.listAllTransactions(filters);
    return success(res, 'Transactions retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Update a transaction status
 * @route PUT /api/admin/transactions/:id/status
 */
const updateTransactionStatus = async (req, res, next) => {
  try {
    const transactionId = req.params.id;
    const { status }    = req.body;

    const transaction = await adminService.updateTransactionStatus(transactionId, status);
    return success(res, 'Transaction status updated', { transaction });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  listUsers,
  getUserById,
  updateUser,
  listAllBooks,
  removeBook,
  listAllTransactions,
  updateTransactionStatus,
};
