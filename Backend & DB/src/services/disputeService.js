/**
 * Dispute Service
 * Business logic for raising and managing disputes on completed transactions.
 *
 * Design:
 * - Only transaction participants (buyer or seller) may raise a dispute.
 * - One open dispute per transaction at a time.
 * - Status transitions:  open → under_review → resolved | dismissed
 * - Only admins may update dispute status (transition enforcement in routes).
 * - resolved_at is SET when status becomes 'resolved' or 'dismissed'.
 * - All DB operations use parameterized queries.
 */

const { pool } = require('../config/db');
const AppError  = require('../utils/AppError');
const { DISPUTE_STATUS, TRANSACTION_STATUS, PAGINATION } = require('../config/constants');
const { createNotification } = require('./notificationService');

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Fetch a dispute by ID with full details.
 * Throws 404 if not found.
 *
 * @param {number} disputeId
 * @returns {Object}
 */
const getDisputeById = async (disputeId) => {
  const [rows] = await pool.query(
    `SELECT
       d.dispute_id,
       d.transaction_id,
       d.raised_by,
       d.reason,
       d.status,
       d.created_at,
       d.resolved_at,
       u.user_name       AS raised_by_name,
       u.profile_picture AS raised_by_picture,
       t.amount          AS transaction_amount,
       t.status          AS transaction_status
     FROM Dispute d
     JOIN User u        ON d.raised_by      = u.user_id
     JOIN Transaction t ON d.transaction_id = t.transaction_id
     WHERE d.dispute_id = ?`,
    [disputeId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('Dispute not found');
  }

  return rows[0];
};

// ─── Public Service Methods ────────────────────────────────────────────────

/**
 * Raise a dispute on a transaction.
 *
 * Rules:
 * 1. Transaction must exist.
 * 2. User must be a participant (buyer or seller).
 * 3. No existing open/under-review dispute for the same transaction.
 *
 * Note: disputes can be raised on any non-cancelled transaction
 * (the transaction need not be 'completed' — e.g., a dispute about a bad exchange).
 *
 * @param {number} raisedBy      - User raising the dispute
 * @param {number} transactionId
 * @param {string} reason
 * @returns {Object} Created dispute
 */
const raiseDispute = async (raisedBy, transactionId, reason) => {
  // Verify transaction exists and get participants
  const [txRows] = await pool.query(
    `SELECT
       t.transaction_id,
       t.status,
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

  // Must be a participant
  const isParticipant = tx.buyer_id === raisedBy || tx.seller_id === raisedBy;

  if (!isParticipant) {
    throw AppError.forbidden('You are not a participant in this transaction');
  }

  // Cannot raise a dispute on a cancelled transaction
  if (tx.status === TRANSACTION_STATUS.CANCELLED) {
    throw AppError.badRequest('Cannot raise a dispute on a cancelled transaction');
  }

  // Check for existing active dispute on this transaction
  const [existingDisputes] = await pool.query(
    `SELECT dispute_id FROM Dispute
     WHERE transaction_id = ? AND status IN (?, ?)`,
    [transactionId, DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW]
  );

  if (existingDisputes.length > 0) {
    throw AppError.conflict(
      'An active dispute already exists for this transaction'
    );
  }

  const [result] = await pool.query(
    `INSERT INTO Dispute (transaction_id, raised_by, reason, status)
     VALUES (?, ?, ?, ?)`,
    [transactionId, raisedBy, reason, DISPUTE_STATUS.OPEN]
  );

  const disputeRecord = await getDisputeById(result.insertId);

  const recipientId = raisedBy === tx.buyer_id ? tx.seller_id : tx.buyer_id;
  await createNotification(
    recipientId,
    'dispute',
    `A dispute was raised on your transaction by ${disputeRecord.raised_by_name}`,
    result.insertId,
    'dispute'
  );

  return disputeRecord;
};

/**
 * Get disputes for the current user (disputes they raised or are involved in).
 *
 * @param {number} userId
 * @param {string} role
 * @param {number} page
 * @param {number} limit
 * @returns {Object} { disputes, pagination }
 */
const getUserDisputes = async (userId, role, page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT) => {
  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  let whereClause;
  let params;

  if (role === 'admin') {
    // Admins see all disputes
    whereClause = '1=1';
    params = [];
  } else {
    // Users see disputes where they are the raiser OR a transaction participant
    whereClause = 'd.raised_by = ? OR n.buyer_id = ? OR b.seller_id = ?';
    params = [userId, userId, userId];
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM Dispute d
     JOIN Transaction t ON d.transaction_id = t.transaction_id
     JOIN Negotiation n ON t.negotiation_id = n.negotiation_id
     JOIN Book b        ON n.book_id        = b.book_id
     WHERE ${whereClause}`,
    params
  );

  const total = countRows[0].total;

  const [disputes] = await pool.query(
    `SELECT
       d.dispute_id,
       d.transaction_id,
       d.raised_by,
       d.reason,
       d.status,
       d.created_at,
       d.resolved_at,
       raiser.user_name        AS raised_by_name,
       raiser.profile_picture  AS raised_by_picture,
       t.amount                AS transaction_amount,
       book.title              AS book_title
     FROM Dispute d
     JOIN User raiser   ON d.raised_by      = raiser.user_id
     JOIN Transaction t ON d.transaction_id = t.transaction_id
     JOIN Negotiation n ON t.negotiation_id = n.negotiation_id
     JOIN Book book     ON n.book_id        = book.book_id
     JOIN User b_user   ON n.buyer_id       = b_user.user_id
     WHERE ${whereClause}
     ORDER BY d.created_at DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    params
  );

  return {
    disputes,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: queryLimit,
      totalPages: Math.ceil(total / queryLimit),
    },
  };
};

/**
 * Get full details of a single dispute.
 * Only participants or admins may view it.
 *
 * @param {number} disputeId
 * @param {number} userId
 * @param {string} role
 * @returns {Object} dispute
 */
const getDisputeDetails = async (disputeId, userId, role) => {
  const dispute = await getDisputeById(disputeId);

  if (role !== 'admin') {
    // Fetch transaction participants to verify access
    const [txRows] = await pool.query(
      `SELECT n.buyer_id, b.seller_id
       FROM Transaction t
       JOIN Negotiation n ON t.negotiation_id = n.negotiation_id
       JOIN Book b        ON n.book_id        = b.book_id
       WHERE t.transaction_id = ?`,
      [dispute.transaction_id]
    );

    if (txRows.length === 0) {
      throw AppError.notFound('Transaction not found');
    }

    const isParticipant =
      txRows[0].buyer_id === userId || txRows[0].seller_id === userId;

    if (!isParticipant) {
      throw AppError.forbidden('You are not a participant in this dispute');
    }
  }

  return dispute;
};

/**
 * Update dispute status. Admin only (enforced at the route level).
 *
 * Valid transitions:
 *   open         → under_review | dismissed
 *   under_review → resolved | dismissed
 *
 * resolved_at is set when transitioning to 'resolved' or 'dismissed'.
 *
 * @param {number} disputeId
 * @param {string} newStatus
 * @returns {Object} Updated dispute
 */
const updateDisputeStatus = async (disputeId, newStatus) => {
  const dispute = await getDisputeById(disputeId);

  // Validate transition
  const validTransitions = {
    [DISPUTE_STATUS.OPEN]:         [DISPUTE_STATUS.UNDER_REVIEW, DISPUTE_STATUS.DISMISSED],
    [DISPUTE_STATUS.UNDER_REVIEW]: [DISPUTE_STATUS.RESOLVED,     DISPUTE_STATUS.DISMISSED],
  };

  const allowed = validTransitions[dispute.status];

  if (!allowed) {
    throw AppError.badRequest(
      `Dispute is already ${dispute.status} and cannot be updated further`
    );
  }

  if (!allowed.includes(newStatus)) {
    throw AppError.badRequest(
      `Invalid transition: ${dispute.status} → ${newStatus}. Allowed: ${allowed.join(', ')}`
    );
  }

  const isTerminal = [DISPUTE_STATUS.RESOLVED, DISPUTE_STATUS.DISMISSED].includes(newStatus);

  await pool.query(
    `UPDATE Dispute
     SET status = ?,
         resolved_at = ${isTerminal ? 'CURRENT_TIMESTAMP' : 'NULL'}
     WHERE dispute_id = ?`,
    [newStatus, disputeId]
  );

  const updatedDispute = await getDisputeById(disputeId);

  if (isTerminal) {
    // Notify both participants
    const [txRows] = await pool.query(
      `SELECT n.buyer_id, b.seller_id
       FROM Transaction t
       JOIN Negotiation n ON t.negotiation_id = n.negotiation_id
       JOIN Book b        ON n.book_id        = b.book_id
       WHERE t.transaction_id = ?`,
      [updatedDispute.transaction_id]
    );

    if (txRows.length > 0) {
      const tx = txRows[0];
      const msg = `Dispute on transaction was ${newStatus}`;
      await createNotification(tx.buyer_id, 'dispute', msg, disputeId, 'dispute');
      if (tx.seller_id !== tx.buyer_id) {
        await createNotification(tx.seller_id, 'dispute', msg, disputeId, 'dispute');
      }
    }
  }

  return updatedDispute;
};

module.exports = {
  raiseDispute,
  getUserDisputes,
  getDisputeDetails,
  updateDisputeStatus,
};
