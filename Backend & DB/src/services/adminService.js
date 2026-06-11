/**
 * Admin Service
 * Business logic for all admin-only operations.
 *
 * Admin capabilities:
 * - User management: list, view, update role, deactivate/reactivate
 * - Book management: view all statuses, force-remove listings
 * - Transaction management: mark transactions completed or cancelled
 * - Platform overview: summary statistics dashboard
 *
 * All endpoints protected by requireRole('admin') at the route level.
 * All DB operations use parameterized queries.
 */

const { pool } = require('../config/db');
const AppError  = require('../utils/AppError');
const {
  ROLES,
  BOOK_STATUS,
  TRANSACTION_STATUS,
  PAGINATION,
} = require('../config/constants');

// ─── User Management ───────────────────────────────────────────────────────

/**
 * List all users with optional role filter and pagination.
 *
 * @param {Object} filters
 * @returns {Object} { users, pagination }
 */
const listUsers = async (filters) => {
  const {
    role,
    search,
    page  = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
  } = filters;

  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  let whereClauses = [];
  let params       = [];

  if (role) {
    whereClauses.push('role = ?');
    params.push(role);
  }

  if (search) {
    whereClauses.push('(user_name LIKE ? OR email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM User ${where}`,
    params
  );

  const total = countRows[0].total;

  const [users] = await pool.query(
    `SELECT
       user_id, google_id, user_name, email, email_verified,
       profile_picture, role, seller_verified, usn,
       created_at, updated_at
     FROM User
     ${where}
     ORDER BY created_at DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    params
  );

  return {
    users,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: queryLimit,
      totalPages: Math.ceil(total / queryLimit),
    },
  };
};

/**
 * Get a single user's full profile by ID.
 *
 * @param {number} userId
 * @returns {Object} User record
 */
const getUserById = async (userId) => {
  const [rows] = await pool.query(
    `SELECT
       user_id, google_id, user_name, email, email_verified,
       profile_picture, role, seller_verified, usn,
       created_at, updated_at
     FROM User WHERE user_id = ?`,
    [userId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('User not found');
  }

  return rows[0];
};

/**
 * Update a user's role or seller_verified flag.
 * Admins cannot demote other admins (safety guard).
 *
 * @param {number} targetUserId
 * @param {number} adminId       - The admin performing the update
 * @param {Object} updateData    - { role?, seller_verified? }
 * @returns {Object} Updated user
 */
const updateUser = async (targetUserId, adminId, updateData) => {
  const target = await getUserById(targetUserId);

  // Admins cannot modify their own role via this endpoint
  if (targetUserId === adminId) {
    throw AppError.forbidden('Administrators cannot modify their own role through this endpoint');
  }

  // Prevent demoting another admin
  if (target.role === ROLES.ADMIN && updateData.role && updateData.role !== ROLES.ADMIN) {
    throw AppError.forbidden('Cannot change the role of another administrator');
  }

  const allowedFields = ['role', 'seller_verified'];
  const updateFields  = [];
  const params        = [];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      params.push(updateData[field]);
    }
  }

  if (updateFields.length === 0) {
    return target;
  }

  params.push(targetUserId);

  await pool.query(
    `UPDATE User SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    params
  );

  return getUserById(targetUserId);
};

// ─── Book Management ───────────────────────────────────────────────────────

/**
 * List all books regardless of status (admin view).
 * Supports filtering by status, seller, and search.
 *
 * @param {Object} filters
 * @returns {Object} { books, pagination }
 */
const listAllBooks = async (filters) => {
  const {
    status,
    sellerId,
    q,
    page  = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
  } = filters;

  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  let whereClauses = [];
  let params       = [];

  if (status) {
    whereClauses.push('b.status = ?');
    params.push(status);
  }

  if (sellerId) {
    whereClauses.push('b.seller_id = ?');
    params.push(parseInt(sellerId, 10));
  }

  if (q) {
    whereClauses.push('MATCH(b.title, b.author, b.description) AGAINST(? IN BOOLEAN MODE)');
    params.push(q.split(' ').map(t => `${t}*`).join(' '));
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM Book b ${where}`,
    params
  );

  const total = countRows[0].total;

  const [books] = await pool.query(
    `SELECT b.*, u.user_name AS seller_name, u.email AS seller_email
     FROM Book b
     JOIN User u ON b.seller_id = u.user_id
     ${where}
     ORDER BY b.created_at DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    params
  );

  return {
    books,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: queryLimit,
      totalPages: Math.ceil(total / queryLimit),
    },
  };
};

/**
 * Force-remove a book listing (hard status override to 'removed').
 * Used by admins to take down inappropriate or violating listings.
 *
 * @param {number} bookId
 * @returns {{ message: string }}
 */
const removeBook = async (bookId) => {
  const [rows] = await pool.query(
    'SELECT book_id, status FROM Book WHERE book_id = ?',
    [bookId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('Book not found');
  }

  if (rows[0].status === BOOK_STATUS.REMOVED) {
    throw AppError.conflict('Book is already removed');
  }

  await pool.query(
    `UPDATE Book SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE book_id = ?`,
    [BOOK_STATUS.REMOVED, bookId]
  );

  return { message: 'Book listing removed by admin' };
};

// ─── Transaction Management ─────────────────────────────────────────────────

/**
 * List all transactions (admin only).
 *
 * @param {Object} filters
 * @returns {Object} { transactions, pagination }
 */
const listAllTransactions = async (filters) => {
  const {
    status,
    page  = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
  } = filters;

  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  let whereClauses = [];
  let params       = [];

  if (status) {
    whereClauses.push('t.status = ?');
    params.push(status);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM Transaction t ${where}`,
    params
  );

  const total = countRows[0].total;

  const [transactions] = await pool.query(
    `SELECT
       t.transaction_id, t.negotiation_id, t.amount, t.status,
       t.created_at, t.updated_at,
       buyer.user_name  AS buyer_name,
       seller.user_name AS seller_name,
       bk.title         AS book_title
     FROM Transaction t
     JOIN Negotiation n  ON t.negotiation_id = n.negotiation_id
     JOIN Book bk        ON n.book_id        = bk.book_id
     JOIN User buyer     ON n.buyer_id       = buyer.user_id
     JOIN User seller    ON bk.seller_id     = seller.user_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    params
  );

  return {
    transactions,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: queryLimit,
      totalPages: Math.ceil(total / queryLimit),
    },
  };
};

/**
 * Update a transaction's status (admin override).
 * Valid transitions: pending → completed | cancelled
 *
 * @param {number} transactionId
 * @param {string} newStatus
 * @returns {Object} Updated transaction
 */
const updateTransactionStatus = async (transactionId, newStatus) => {
  const [rows] = await pool.query(
    'SELECT transaction_id, status FROM Transaction WHERE transaction_id = ?',
    [transactionId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('Transaction not found');
  }

  const current = rows[0].status;

  if (current === newStatus) {
    throw AppError.conflict(`Transaction is already ${newStatus}`);
  }

  const validTransitions = {
    [TRANSACTION_STATUS.PENDING]:   [TRANSACTION_STATUS.COMPLETED, TRANSACTION_STATUS.CANCELLED],
    [TRANSACTION_STATUS.COMPLETED]: [],
    [TRANSACTION_STATUS.CANCELLED]: [],
  };

  const allowed = validTransitions[current] || [];

  if (!allowed.includes(newStatus)) {
    throw AppError.badRequest(
      `Invalid transition: ${current} → ${newStatus}${allowed.length ? `. Allowed: ${allowed.join(', ')}` : '. This status is terminal.'}`
    );
  }

  await pool.query(
    `UPDATE Transaction SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?`,
    [newStatus, transactionId]
  );

  const [updated] = await pool.query(
    'SELECT * FROM Transaction WHERE transaction_id = ?',
    [transactionId]
  );

  return updated[0];
};

// ─── Dashboard Statistics ──────────────────────────────────────────────────

/**
 * Get a platform-wide summary for the admin dashboard.
 *
 * @returns {Object} Platform stats
 */
const getDashboardStats = async () => {
  const [[userStats]] = await pool.query(
    `SELECT
       COUNT(*)                                               AS total_users,
       SUM(CASE WHEN role = 'buyer'  THEN 1 ELSE 0 END)     AS buyers,
       SUM(CASE WHEN role = 'seller' THEN 1 ELSE 0 END)      AS sellers,
       SUM(CASE WHEN role = 'admin'  THEN 1 ELSE 0 END)      AS admins,
       SUM(CASE WHEN seller_verified = 1 THEN 1 ELSE 0 END)  AS verified_sellers
     FROM User`
  );

  const [[bookStats]] = await pool.query(
    `SELECT
       COUNT(*)                                                   AS total_books,
       SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END)    AS available,
       SUM(CASE WHEN status = 'reserved'  THEN 1 ELSE 0 END)    AS reserved,
       SUM(CASE WHEN status = 'sold'      THEN 1 ELSE 0 END)    AS sold,
       SUM(CASE WHEN status = 'removed'   THEN 1 ELSE 0 END)    AS removed
     FROM Book`
  );

  const [[negotiationStats]] = await pool.query(
    `SELECT
       COUNT(*)                                                    AS total_negotiations,
       SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END)     AS active,
       SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END)     AS accepted,
       SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END)     AS rejected,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)    AS cancelled
     FROM Negotiation`
  );

  const [[transactionStats]] = await pool.query(
    `SELECT
       COUNT(*)                                                     AS total_transactions,
       SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)     AS pending,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)     AS completed,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)     AS cancelled,
       COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS total_completed_value
     FROM Transaction`
  );

  const [[disputeStats]] = await pool.query(
    `SELECT
       COUNT(*)                                                         AS total_disputes,
       SUM(CASE WHEN status = 'open'         THEN 1 ELSE 0 END)       AS open,
       SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END)       AS under_review,
       SUM(CASE WHEN status = 'resolved'     THEN 1 ELSE 0 END)       AS resolved,
       SUM(CASE WHEN status = 'dismissed'    THEN 1 ELSE 0 END)       AS dismissed
     FROM Dispute`
  );

  return {
    users:        userStats,
    books:        bookStats,
    negotiations: negotiationStats,
    transactions: transactionStats,
    disputes:     disputeStats,
  };
};

module.exports = {
  listUsers,
  getUserById,
  updateUser,
  listAllBooks,
  removeBook,
  listAllTransactions,
  updateTransactionStatus,
  getDashboardStats,
};
