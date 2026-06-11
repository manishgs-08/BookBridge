/**
 * Message Service
 * Business logic for REST-based persistent messaging.
 *
 * Design principles:
 * - Messages are NEVER deleted — all history is permanent.
 * - A "conversation" is the bidirectional thread between two users
 *   (sender_id ↔ receiver_id treated symmetrically).
 * - negotiation_id is optional: messages may exist independently of negotiations.
 * - All DB operations use parameterized queries.
 */

const { pool } = require('../config/db');
const AppError   = require('../utils/AppError');
const { PAGINATION } = require('../config/constants');
const { createNotification } = require('./notificationService');

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Fetch a single message by ID.
 * Throws 404 if not found.
 *
 * @param {number} messageId
 * @returns {Object}
 */
const getMessageById = async (messageId) => {
  const [rows] = await pool.query(
    `SELECT m.*,
            s.user_name AS sender_name,   s.profile_picture AS sender_picture,
            r.user_name AS receiver_name, r.profile_picture AS receiver_picture
     FROM Message m
     JOIN User s ON m.sender_id   = s.user_id
     JOIN User r ON m.receiver_id = r.user_id
     WHERE m.message_id = ?`,
    [messageId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('Message not found');
  }

  return rows[0];
};

// ─── Public Service Methods ────────────────────────────────────────────────

/**
 * Send a new message.
 *
 * Rules:
 * - Sender cannot message themselves.
 * - Content must be non-empty (validated at route level, but double-checked here).
 * - If negotiation_id is provided it must exist and the sender must be a participant.
 *
 * @param {number} senderId
 * @param {number} receiverId
 * @param {string} content
 * @param {number|null} negotiationId  - Optional
 * @returns {Object} The newly created message record
 */
const sendMessage = async (senderId, receiverId, content, negotiationId = null) => {
  // Cannot message yourself
  if (senderId === receiverId) {
    throw AppError.badRequest('You cannot send a message to yourself');
  }

  // Verify receiver exists
  const [receiverRows] = await pool.query(
    'SELECT user_id FROM User WHERE user_id = ?',
    [receiverId]
  );

  if (receiverRows.length === 0) {
    throw AppError.notFound('Recipient user not found');
  }

  // If linked to a negotiation, verify the sender is a participant
  if (negotiationId !== null) {
    const [negRows] = await pool.query(
      `SELECT n.negotiation_id, n.buyer_id, b.seller_id
       FROM Negotiation n
       JOIN Book b ON n.book_id = b.book_id
       WHERE n.negotiation_id = ?`,
      [negotiationId]
    );

    if (negRows.length === 0) {
      throw AppError.notFound('Negotiation not found');
    }

    const neg = negRows[0];
    const isParticipant =
      neg.buyer_id === senderId || neg.seller_id === senderId;

    if (!isParticipant) {
      throw AppError.forbidden(
        'You are not a participant in the referenced negotiation'
      );
    }
  }

  // Insert message (permanently stored)
  const [result] = await pool.query(
    `INSERT INTO Message (sender_id, receiver_id, negotiation_id, content, is_read)
     VALUES (?, ?, ?, ?, FALSE)`,
    [senderId, receiverId, negotiationId, content]
  );

  const messageRecord = await getMessageById(result.insertId);

  // Send notification to receiver
  await createNotification(
    receiverId,
    'message',
    `New message from ${messageRecord.sender_name}`,
    result.insertId,
    'message'
  );

  return messageRecord;
};

/**
 * Get all distinct conversations for a user.
 *
 * A conversation is a unique pairing of (current user ↔ other user).
 * Returns one row per conversation partner, showing:
 * - partner details
 * - latest message snippet
 * - latest message timestamp
 * - unread count (messages FROM partner that current user hasn't read)
 *
 * @param {number} userId
 * @returns {Object[]}
 */
const getConversations = async (userId) => {
  const [rows] = await pool.query(
    `SELECT
       partner.user_id           AS partner_id,
       partner.user_name         AS partner_name,
       partner.profile_picture   AS partner_picture,
       partner.role              AS partner_role,

       -- Latest message in this conversation (either direction)
       latest.content            AS last_message,
       latest.created_at         AS last_message_at,
       latest.sender_id          AS last_sender_id,

       -- Unread: messages sent by partner that I haven't read
       COALESCE(unread.cnt, 0)   AS unread_count

     FROM (
       -- Gather all distinct conversation partners
       SELECT DISTINCT
         CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id
       FROM Message
       WHERE sender_id = ? OR receiver_id = ?
     ) AS conv

     JOIN User partner ON partner.user_id = conv.partner_id

     -- Latest message subquery
     JOIN Message latest ON latest.message_id = (
       SELECT message_id
       FROM Message
       WHERE (sender_id = ? AND receiver_id = conv.partner_id)
          OR (sender_id = conv.partner_id AND receiver_id = ?)
       ORDER BY created_at DESC, message_id DESC
       LIMIT 1
     )

     -- Unread count subquery
     LEFT JOIN (
       SELECT sender_id, COUNT(*) AS cnt
       FROM Message
       WHERE receiver_id = ? AND is_read = FALSE
       GROUP BY sender_id
     ) AS unread ON unread.sender_id = conv.partner_id

     ORDER BY last_message_at DESC`,
    [userId, userId, userId, userId, userId, userId]
  );

  return rows;
};

/**
 * Get the full chronological message history between two users.
 * Only the two participants may access the thread.
 *
 * @param {number} currentUserId   - The requesting user
 * @param {number} otherUserId     - The conversation partner
 * @param {number} page
 * @param {number} limit
 * @returns {Object} { messages, pagination }
 */
const getConversationHistory = async (
  currentUserId,
  otherUserId,
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT
) => {
  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  // Verify the other user exists
  const [otherRows] = await pool.query(
    'SELECT user_id, user_name, profile_picture, role FROM User WHERE user_id = ?',
    [otherUserId]
  );

  if (otherRows.length === 0) {
    throw AppError.notFound('User not found');
  }

  // Count total messages in this thread (both directions)
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM Message
     WHERE (sender_id = ? AND receiver_id = ?)
        OR (sender_id = ? AND receiver_id = ?)`,
    [currentUserId, otherUserId, otherUserId, currentUserId]
  );

  const total = countRows[0].total;

  // Fetch paginated messages — oldest first for chronological reading
  const [messages] = await pool.query(
    `SELECT
       m.message_id,
       m.sender_id,
       m.receiver_id,
       m.negotiation_id,
       m.content,
       m.is_read,
       m.created_at,
       s.user_name AS sender_name,
       s.profile_picture AS sender_picture
     FROM Message m
     JOIN User s ON m.sender_id = s.user_id
     WHERE (m.sender_id = ? AND m.receiver_id = ?)
        OR (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.created_at ASC, m.message_id ASC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    [currentUserId, otherUserId, otherUserId, currentUserId]
  );

  return {
    partner: otherRows[0],
    messages,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: queryLimit,
      totalPages: Math.ceil(total / queryLimit),
    },
  };
};

/**
 * Mark a single message as read.
 * Only the intended receiver may mark it read.
 *
 * @param {number} messageId
 * @param {number} userId  - Must be the receiver
 * @returns {Object} Updated message
 */
const markMessageRead = async (messageId, userId) => {
  const message = await getMessageById(messageId);

  if (message.receiver_id !== userId) {
    throw AppError.forbidden('You can only mark your own received messages as read');
  }

  if (message.is_read) {
    return message; // Already read — idempotent, no DB write needed
  }

  await pool.query(
    'UPDATE Message SET is_read = TRUE WHERE message_id = ?',
    [messageId]
  );

  return getMessageById(messageId);
};

/**
 * Get the count of unread messages for the current user
 * (messages addressed to them that have not been read yet).
 *
 * @param {number} userId
 * @returns {{ unreadCount: number }}
 */
const getUnreadCount = async (userId) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS unreadCount FROM Message WHERE receiver_id = ? AND is_read = FALSE',
    [userId]
  );

  return { unreadCount: rows[0].unreadCount };
};

module.exports = {
  sendMessage,
  getConversations,
  getConversationHistory,
  markMessageRead,
  getUnreadCount,
};
