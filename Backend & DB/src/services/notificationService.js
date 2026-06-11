/**
 * Notification Service
 * Business logic for in-app notifications.
 *
 * Design:
 * - Notifications are INSERT-only — never deleted by users (hard delete only for cascade on user delete).
 * - A helper `createNotification()` is exported so other services (Phase 6+) can emit
 *   notifications without coupling to the HTTP layer.
 * - Supported types mirror the DB enum: offer | counteroffer | message | transaction | dispute | review | system
 * - reference_id + reference_type provide polymorphic linking back to the source record.
 * - All DB operations use parameterized queries.
 */

const { pool } = require('../config/db');
const AppError  = require('../utils/AppError');
const { PAGINATION } = require('../config/constants');

// ─── Internal / Cross-Service Helper ──────────────────────────────────────

/**
 * Create a notification for a user.
 * Called internally by other services (negotiations, messages, etc.)
 * when they need to emit a notification without going through the HTTP layer.
 *
 * @param {Object} opts
 * @param {number}      opts.userId        - Recipient
 * @param {string}      opts.type          - Notification type enum value
 * @param {string}      opts.title
 * @param {string|null} opts.content
 * @param {number|null} opts.referenceId   - ID of the source record
 * @param {string|null} opts.referenceType - e.g. 'Negotiation', 'Message', 'Transaction'
 * @returns {number} Inserted notification_id
 */
const createNotification = async ({
  userId,
  type,
  title,
  content     = null,
  referenceId   = null,
  referenceType = null,
}) => {
  const [result] = await pool.query(
    `INSERT INTO Notification
       (user_id, type, title, content, reference_id, reference_type, is_read)
     VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
    [userId, type, title, content, referenceId, referenceType]
  );

  return result.insertId;
};

// ─── Public Service Methods ────────────────────────────────────────────────

/**
 * Get all notifications for the current user, newest first.
 * Supports pagination.
 *
 * @param {number} userId
 * @param {number} page
 * @param {number} limit
 * @returns {Object} { notifications, unreadCount, pagination }
 */
const getNotifications = async (userId, page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT) => {
  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  const [countRows] = await pool.query(
    `SELECT
       COUNT(*)                              AS total,
       SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_count
     FROM Notification WHERE user_id = ?`,
    [userId]
  );

  const total       = countRows[0].total;
  const unreadCount = countRows[0].unread_count || 0;

  const [notifications] = await pool.query(
    `SELECT
       notification_id,
       user_id,
       type,
       title,
       content,
       reference_id,
       reference_type,
       is_read,
       created_at
     FROM Notification
     WHERE user_id = ?
     ORDER BY created_at DESC, notification_id DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    [userId]
  );

  return {
    notifications,
    unreadCount: parseInt(unreadCount, 10),
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: queryLimit,
      totalPages: Math.ceil(total / queryLimit),
    },
  };
};

/**
 * Mark a single notification as read.
 * Only the notification's owner may mark it read.
 *
 * @param {number} notificationId
 * @param {number} userId
 * @returns {Object} Updated notification
 */
const markNotificationRead = async (notificationId, userId) => {
  const [rows] = await pool.query(
    'SELECT notification_id, user_id, is_read FROM Notification WHERE notification_id = ?',
    [notificationId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('Notification not found');
  }

  if (rows[0].user_id !== userId) {
    throw AppError.forbidden('You can only mark your own notifications as read');
  }

  if (rows[0].is_read) {
    return rows[0]; // Already read — idempotent
  }

  await pool.query(
    'UPDATE Notification SET is_read = TRUE WHERE notification_id = ?',
    [notificationId]
  );

  const [updated] = await pool.query(
    'SELECT * FROM Notification WHERE notification_id = ?',
    [notificationId]
  );

  return updated[0];
};

/**
 * Mark ALL unread notifications as read for the current user.
 *
 * @param {number} userId
 * @returns {{ markedCount: number }}
 */
const markAllNotificationsRead = async (userId) => {
  const [result] = await pool.query(
    'UPDATE Notification SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );

  return { markedCount: result.affectedRows };
};

/**
 * Get the unread notification count for the current user.
 * Lightweight — used for badge counts.
 *
 * @param {number} userId
 * @returns {{ unreadCount: number }}
 */
const getUnreadCount = async (userId) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS unreadCount FROM Notification WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );

  return { unreadCount: rows[0].unreadCount };
};

module.exports = {
  createNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
};
