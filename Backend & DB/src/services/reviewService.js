/**
 * Review Service
 * Business logic for post-transaction user ratings and reviews.
 *
 * Design:
 * - Only transaction participants (buyer or seller) may review each other.
 * - One review per reviewer per transaction (unique constraint in DB).
 * - Transaction must be in 'completed' status before a review is allowed.
 * - Rating must be 1–5 (CHECK constraint in DB; also validated at route level).
 * - All DB operations use parameterized queries.
 */

const { pool }  = require('../config/db');
const AppError   = require('../utils/AppError');
const { TRANSACTION_STATUS, PAGINATION } = require('../config/constants');
const { createNotification } = require('./notificationService');

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Fetch a review by ID.
 * Throws 404 if not found.
 *
 * @param {number} reviewId
 * @returns {Object}
 */
const getReviewById = async (reviewId) => {
  const [rows] = await pool.query(
    `SELECT
       r.review_id,
       r.reviewer_id,
       r.reviewed_user_id,
       r.transaction_id,
       r.rating,
       r.comment,
       r.created_at,
       reviewer.user_name        AS reviewer_name,
       reviewer.profile_picture  AS reviewer_picture,
       reviewed.user_name        AS reviewed_user_name,
       reviewed.profile_picture  AS reviewed_user_picture
     FROM Review r
     JOIN User reviewer ON r.reviewer_id      = reviewer.user_id
     JOIN User reviewed ON r.reviewed_user_id = reviewed.user_id
     WHERE r.review_id = ?`,
    [reviewId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('Review not found');
  }

  return rows[0];
};

// ─── Public Service Methods ────────────────────────────────────────────────

/**
 * Create a review after a completed transaction.
 *
 * Rules enforced:
 * 1. Transaction must exist and be 'completed'.
 * 2. Reviewer must be a participant (buyer or seller) of the transaction.
 * 3. Reviewer cannot review themselves.
 * 4. The reviewed_user_id must be the other participant.
 * 5. One review per reviewer per transaction (unique constraint).
 *
 * @param {number} reviewerId
 * @param {number} transactionId
 * @param {number} reviewedUserId
 * @param {number} rating   (1–5)
 * @param {string|null} comment
 * @returns {Object} Created review
 */
const createReview = async (reviewerId, transactionId, reviewedUserId, rating, comment = null) => {
  // Cannot review yourself
  if (reviewerId === reviewedUserId) {
    throw AppError.badRequest('You cannot review yourself');
  }

  // Fetch transaction with negotiation + book + participants
  const [txRows] = await pool.query(
    `SELECT
       t.transaction_id,
       t.status,
       t.amount,
       n.buyer_id,
       b.seller_id
     FROM Transaction t
     JOIN Negotiation n ON t.negotiation_id = n.negotiation_id
     JOIN Book b        ON n.book_id        = b.book_id
     WHERE t.transaction_id = ?`,
    [transactionId]
  );

  if (txRows.length === 0) {
    throw AppError.notFound('Transaction not found');
  }

  const tx = txRows[0];

  // Transaction must be completed before reviews are allowed
  if (tx.status !== TRANSACTION_STATUS.COMPLETED) {
    throw AppError.badRequest(
      'Reviews can only be submitted for completed transactions'
    );
  }

  // Reviewer must be a participant
  const isBuyer  = tx.buyer_id  === reviewerId;
  const isSeller = tx.seller_id === reviewerId;

  if (!isBuyer && !isSeller) {
    throw AppError.forbidden('You are not a participant in this transaction');
  }

  // reviewed_user_id must be the other participant
  const expectedReviewedId = isBuyer ? tx.seller_id : tx.buyer_id;

  if (reviewedUserId !== expectedReviewedId) {
    throw AppError.badRequest(
      'You can only review the other party of this transaction'
    );
  }

  // Check for duplicate review (friendly message before DB throws ER_DUP_ENTRY)
  const [existing] = await pool.query(
    'SELECT review_id FROM Review WHERE reviewer_id = ? AND transaction_id = ?',
    [reviewerId, transactionId]
  );

  if (existing.length > 0) {
    throw AppError.conflict('You have already reviewed this transaction');
  }

  const [result] = await pool.query(
    `INSERT INTO Review (reviewer_id, reviewed_user_id, transaction_id, rating, comment)
     VALUES (?, ?, ?, ?, ?)`,
    [reviewerId, reviewedUserId, transactionId, rating, comment || null]
  );

  const reviewRecord = await getReviewById(result.insertId);

  await createNotification(
    reviewedUserId,
    'review',
    `You received a new ${rating}-star review from ${reviewRecord.reviewer_name}`,
    result.insertId,
    'review'
  );

  return reviewRecord;
};

/**
 * Get all reviews written ABOUT a specific user.
 * Used on public seller/buyer profile pages.
 *
 * @param {number} userId      - The user whose reviews are being fetched
 * @param {number} page
 * @param {number} limit
 * @returns {Object} { reviews, pagination, averageRating }
 */
const getReviewsForUser = async (userId, page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT) => {
  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total, AVG(rating) AS avg_rating FROM Review WHERE reviewed_user_id = ?',
    [userId]
  );

  const total        = countRows[0].total;
  const averageRating = countRows[0].avg_rating
    ? parseFloat(countRows[0].avg_rating).toFixed(2)
    : null;

  const [reviews] = await pool.query(
    `SELECT
       r.review_id,
       r.reviewer_id,
       r.reviewed_user_id,
       r.transaction_id,
       r.rating,
       r.comment,
       r.created_at,
       u.user_name       AS reviewer_name,
       u.profile_picture AS reviewer_picture
     FROM Review r
     JOIN User u ON r.reviewer_id = u.user_id
     WHERE r.reviewed_user_id = ?
     ORDER BY r.created_at DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    [userId]
  );

  return {
    reviews,
    averageRating,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: queryLimit,
      totalPages: Math.ceil(total / queryLimit),
    },
  };
};

/**
 * Get a single review by ID.
 *
 * @param {number} reviewId
 * @returns {Object}
 */
const getReview = async (reviewId) => {
  return getReviewById(reviewId);
};

module.exports = {
  createReview,
  getReviewsForUser,
  getReview,
};
