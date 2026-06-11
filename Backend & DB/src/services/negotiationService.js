/**
 * Negotiation Service
 * Business logic for negotiations, offers, counteroffers, and agreement records.
 *
 * Design principles:
 * - Every offer / counteroffer appends a NEW row to Offers — nothing is ever overwritten.
 * - Accepting an offer creates a Transaction (agreement record only, no payment logic).
 * - Book status is set to 'reserved' while a negotiation is active, 'sold' on acceptance.
 * - All DB operations use parameterized queries.
 */

const { pool } = require('../config/db');
const {
  NEGOTIATION_STATUS,
  TRANSACTION_STATUS,
  BOOK_STATUS,
} = require('../config/constants');
const AppError = require('../utils/AppError');
const { createNotification } = require('./notificationService');

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Fetch a negotiation by ID, including book and participant details.
 * Throws 404 if not found.
 *
 * @param {number} negotiationId
 * @returns {Object} Full negotiation record
 */
const getNegotiationById = async (negotiationId) => {
  const [rows] = await pool.query(
    `SELECT
       n.negotiation_id,
       n.book_id,
       n.buyer_id,
       n.status,
       n.created_at,
       n.updated_at,
       b.title        AS book_title,
       b.author       AS book_author,
       b.asking_price AS book_asking_price,
       b.status       AS book_status,
       b.image_url    AS book_image_url,
       b.seller_id,
       seller.user_name      AS seller_name,
       seller.profile_picture AS seller_picture,
       buyer.user_name       AS buyer_name,
       buyer.profile_picture AS buyer_picture
     FROM Negotiation n
     JOIN Book b        ON n.book_id  = b.book_id
     JOIN User seller   ON b.seller_id = seller.user_id
     JOIN User buyer    ON n.buyer_id  = buyer.user_id
     WHERE n.negotiation_id = ?`,
    [negotiationId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('Negotiation not found');
  }

  return rows[0];
};

/**
 * Assert that the requesting user is a participant (buyer OR seller) of the negotiation.
 * Throws 403 if they are not.
 *
 * @param {Object} negotiation - Full negotiation record (from getNegotiationById)
 * @param {number} userId
 */
const assertParticipant = (negotiation, userId) => {
  const isBuyer  = negotiation.buyer_id  === userId;
  const isSeller = negotiation.seller_id === userId;

  if (!isBuyer && !isSeller) {
    throw AppError.forbidden('You are not a participant in this negotiation');
  }
};

/**
 * Assert the negotiation is still active (can receive offers / actions).
 * Throws 400 if it is closed.
 *
 * @param {Object} negotiation
 */
const assertNegotiationActive = (negotiation) => {
  if (negotiation.status !== NEGOTIATION_STATUS.ACTIVE) {
    throw AppError.badRequest(
      `This negotiation is already ${negotiation.status} and cannot receive new offers or actions`
    );
  }
};

/**
 * Fetch the most recent offer in a negotiation.
 * Returns null if no offers exist yet.
 *
 * @param {number} negotiationId
 * @returns {Object|null}
 */
const getLatestOffer = async (negotiationId) => {
  const [rows] = await pool.query(
    `SELECT o.offer_id, o.negotiation_id, o.user_id, o.offered_price, o.timestamp,
            u.user_name, u.role
     FROM Offers o
     JOIN User u ON o.user_id = u.user_id
     WHERE o.negotiation_id = ?
     ORDER BY o.timestamp DESC, o.offer_id DESC
     LIMIT 1`,
    [negotiationId]
  );

  return rows.length > 0 ? rows[0] : null;
};

// ─── Public Service Methods ────────────────────────────────────────────────

/**
 * Create a new negotiation (initiated by buyer).
 *
 * Rules enforced:
 * 1. Book must exist and be available.
 * 2. Buyer cannot be the seller of the book.
 * 3. Buyer cannot open a second active negotiation on the same book.
 *
 * @param {number} buyerId
 * @param {number} bookId
 * @param {number} initialOfferPrice - First offer from the buyer
 * @returns {Object} { negotiation, offer }
 */
const createNegotiation = async (buyerId, bookId, initialOfferPrice) => {
  // 1. Verify book exists and is available
  const [books] = await pool.query(
    'SELECT book_id, seller_id, title, status, asking_price FROM Book WHERE book_id = ?',
    [bookId]
  );

  if (books.length === 0) {
    throw AppError.notFound('Book not found');
  }

  const book = books[0];

  if (book.status !== BOOK_STATUS.AVAILABLE) {
    throw AppError.badRequest(
      `This book is currently ${book.status} and cannot be negotiated on`
    );
  }

  // 2. Buyer cannot negotiate on their own book
  if (book.seller_id === buyerId) {
    throw AppError.forbidden('You cannot negotiate on your own book listing');
  }

  // 3. Check for an existing active negotiation by this buyer on this book
  const [existing] = await pool.query(
    `SELECT negotiation_id FROM Negotiation
     WHERE book_id = ? AND buyer_id = ? AND status = ?`,
    [bookId, buyerId, NEGOTIATION_STATUS.ACTIVE]
  );

  if (existing.length > 0) {
    throw AppError.conflict(
      'You already have an active negotiation for this book. Use the existing negotiation.'
    );
  }

  // 4. Create negotiation record
  const [negResult] = await pool.query(
    `INSERT INTO Negotiation (book_id, buyer_id, status) VALUES (?, ?, ?)`,
    [bookId, buyerId, NEGOTIATION_STATUS.ACTIVE]
  );

  const negotiationId = negResult.insertId;

  // 5. Record the initial offer from the buyer
  const [offerResult] = await pool.query(
    `INSERT INTO Offers (negotiation_id, user_id, offered_price) VALUES (?, ?, ?)`,
    [negotiationId, buyerId, initialOfferPrice]
  );

  // 6. Reserve the book so other buyers know it is being negotiated
  await pool.query(
    `UPDATE Book SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE book_id = ?`,
    [BOOK_STATUS.RESERVED, bookId]
  );

  const negotiation = await getNegotiationById(negotiationId);
  const [offerRows] = await pool.query(
    'SELECT * FROM Offers WHERE offer_id = ?',
    [offerResult.insertId]
  );

  await createNotification(
    book.seller_id,
    'offer',
    `New negotiation started for "${book.title}"`,
    negotiationId,
    'negotiation'
  );

  return { negotiation, offer: offerRows[0] };
};

/**
 * Get all negotiations involving the current user (as buyer or seller).
 *
 * @param {number} userId
 * @param {string} role - User's role ('buyer', 'seller', 'admin')
 * @returns {Object[]} List of negotiations with summary data
 */
const getUserNegotiations = async (userId, role) => {
  let whereClause;
  let params;

  if (role === 'admin') {
    // Admins can see all negotiations
    whereClause = '1=1';
    params = [];
  } else {
    // Regular users see only their own negotiations (as buyer or as seller of the book)
    whereClause = 'n.buyer_id = ? OR b.seller_id = ?';
    params = [userId, userId];
  }

  const [rows] = await pool.query(
    `SELECT
       n.negotiation_id,
       n.book_id,
       n.buyer_id,
       n.status,
       n.created_at,
       n.updated_at,
       b.title        AS book_title,
       b.asking_price AS book_asking_price,
       b.image_url    AS book_image_url,
       b.seller_id,
       seller.user_name  AS seller_name,
       buyer.user_name   AS buyer_name,
       -- Latest offer summary
       (SELECT offered_price
        FROM Offers o2
        WHERE o2.negotiation_id = n.negotiation_id
        ORDER BY o2.timestamp DESC, o2.offer_id DESC
        LIMIT 1) AS latest_offer_price,
       (SELECT COUNT(*)
        FROM Offers o3
        WHERE o3.negotiation_id = n.negotiation_id) AS offer_count
     FROM Negotiation n
     JOIN Book b      ON n.book_id   = b.book_id
     JOIN User seller ON b.seller_id = seller.user_id
     JOIN User buyer  ON n.buyer_id  = buyer.user_id
     WHERE ${whereClause}
     ORDER BY n.updated_at DESC`,
    params
  );

  return rows;
};

/**
 * Get full details of a single negotiation.
 * Access restricted to participants (or admin).
 *
 * @param {number} negotiationId
 * @param {number} userId
 * @param {string} role
 * @returns {Object} Negotiation with latest offer info
 */
const getNegotiationDetails = async (negotiationId, userId, role) => {
  const negotiation = await getNegotiationById(negotiationId);

  if (role !== 'admin') {
    assertParticipant(negotiation, userId);
  }

  // Attach latest offer
  const latestOffer = await getLatestOffer(negotiationId);

  return { ...negotiation, latest_offer: latestOffer };
};

/**
 * Create a new offer inside an existing negotiation.
 *
 * Rules:
 * - Negotiation must be active.
 * - Only participants can place offers.
 * - Price must be > 0.
 * - Turn logic: the participant who made the LAST offer cannot offer again
 *   until the other side responds (prevents spamming).
 *
 * @param {number} negotiationId
 * @param {number} userId
 * @param {number} offeredPrice
 * @returns {Object} Newly created offer
 */
const createOffer = async (negotiationId, userId, offeredPrice) => {
  const negotiation = await getNegotiationById(negotiationId);

  assertParticipant(negotiation, userId);
  assertNegotiationActive(negotiation);

  // Turn enforcement: the last person who made an offer must wait for a response
  const latestOffer = await getLatestOffer(negotiationId);

  if (latestOffer && latestOffer.user_id === userId) {
    throw AppError.badRequest(
      'You made the last offer. Please wait for the other party to respond before placing another offer.'
    );
  }

  // Append new offer row (never overwrite)
  const [result] = await pool.query(
    `INSERT INTO Offers (negotiation_id, user_id, offered_price) VALUES (?, ?, ?)`,
    [negotiationId, userId, offeredPrice]
  );

  // Update negotiation's updated_at so it surfaces at the top of lists
  await pool.query(
    `UPDATE Negotiation SET updated_at = CURRENT_TIMESTAMP WHERE negotiation_id = ?`,
    [negotiationId]
  );

  const [offerRows] = await pool.query(
    `SELECT o.*, u.user_name, u.profile_picture
     FROM Offers o
     JOIN User u ON o.user_id = u.user_id
     WHERE o.offer_id = ?`,
    [result.insertId]
  );

  const recipientId = userId === negotiation.buyer_id ? negotiation.seller_id : negotiation.buyer_id;
  await createNotification(
    recipientId,
    'counteroffer',
    `New counteroffer received for "${negotiation.book_title}"`,
    negotiationId,
    'negotiation'
  );

  return offerRows[0];
};

/**
 * Accept the latest offer in a negotiation.
 *
 * Only the OTHER party can accept (you cannot accept your own offer).
 * On acceptance:
 * 1. Negotiation status → 'accepted'
 * 2. Transaction (agreement record) created at the accepted price
 * 3. Book status → 'sold'
 *
 * @param {number} negotiationId
 * @param {number} userId
 * @returns {Object} { negotiation, transaction }
 */
const acceptOffer = async (negotiationId, userId) => {
  const negotiation = await getNegotiationById(negotiationId);

  assertParticipant(negotiation, userId);
  assertNegotiationActive(negotiation);

  const latestOffer = await getLatestOffer(negotiationId);

  if (!latestOffer) {
    throw AppError.badRequest('There are no offers to accept in this negotiation');
  }

  // You cannot accept your own offer — the other party must accept
  if (latestOffer.user_id === userId) {
    throw AppError.forbidden(
      'You cannot accept your own offer. Wait for the other party to respond.'
    );
  }

  // 1. Mark negotiation as accepted
  await pool.query(
    `UPDATE Negotiation SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE negotiation_id = ?`,
    [NEGOTIATION_STATUS.ACCEPTED, negotiationId]
  );

  // 2. Create agreement record (Transaction — no payment logic)
  const [txResult] = await pool.query(
    `INSERT INTO Transaction (negotiation_id, amount, status) VALUES (?, ?, ?)`,
    [negotiationId, latestOffer.offered_price, TRANSACTION_STATUS.PENDING]
  );

  // 3. Mark book as sold
  await pool.query(
    `UPDATE Book SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE book_id = ?`,
    [BOOK_STATUS.SOLD, negotiation.book_id]
  );

  // Fetch refreshed records
  const updatedNegotiation = await getNegotiationById(negotiationId);

  const [txRows] = await pool.query(
    'SELECT * FROM Transaction WHERE transaction_id = ?',
    [txResult.insertId]
  );

  const recipientId = userId === updatedNegotiation.buyer_id ? updatedNegotiation.seller_id : updatedNegotiation.buyer_id;
  await createNotification(
    recipientId,
    'transaction',
    `Your offer for "${updatedNegotiation.book_title}" was accepted!`,
    txResult.insertId,
    'transaction'
  );

  return { negotiation: updatedNegotiation, transaction: txRows[0] };
};

/**
 * Reject the current negotiation.
 *
 * Either participant can reject.
 * On rejection:
 * 1. Negotiation status → 'rejected'
 * 2. Book status reverts to 'available' (if no other active negotiations remain)
 *
 * @param {number} negotiationId
 * @param {number} userId
 * @returns {Object} Updated negotiation
 */
const rejectNegotiation = async (negotiationId, userId) => {
  const negotiation = await getNegotiationById(negotiationId);

  assertParticipant(negotiation, userId);
  assertNegotiationActive(negotiation);

  // Mark negotiation as rejected
  await pool.query(
    `UPDATE Negotiation SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE negotiation_id = ?`,
    [NEGOTIATION_STATUS.REJECTED, negotiationId]
  );

  // Re-open the book if no other active negotiations exist for it
  await releaseBookIfFree(negotiation.book_id);

  const recipientId = userId === negotiation.buyer_id ? negotiation.seller_id : negotiation.buyer_id;
  await createNotification(
    recipientId,
    'system',
    `Negotiation for "${negotiation.book_title}" was rejected`,
    negotiationId,
    'negotiation'
  );

  return getNegotiationById(negotiationId);
};

/**
 * Cancel a negotiation (initiated by a participant who wants to withdraw).
 *
 * @param {number} negotiationId
 * @param {number} userId
 * @returns {Object} Updated negotiation
 */
const cancelNegotiation = async (negotiationId, userId) => {
  const negotiation = await getNegotiationById(negotiationId);

  assertParticipant(negotiation, userId);
  assertNegotiationActive(negotiation);

  await pool.query(
    `UPDATE Negotiation SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE negotiation_id = ?`,
    [NEGOTIATION_STATUS.CANCELLED, negotiationId]
  );

  await releaseBookIfFree(negotiation.book_id);

  const recipientId = userId === negotiation.buyer_id ? negotiation.seller_id : negotiation.buyer_id;
  await createNotification(
    recipientId,
    'system',
    `Negotiation for "${negotiation.book_title}" was cancelled`,
    negotiationId,
    'negotiation'
  );

  return getNegotiationById(negotiationId);
};

/**
 * Get the full chronological offer / counteroffer history for a negotiation.
 * Access restricted to participants (or admin).
 *
 * @param {number} negotiationId
 * @param {number} userId
 * @param {string} role
 * @returns {Object} { negotiation, history, acceptedOffer }
 */
const getNegotiationHistory = async (negotiationId, userId, role) => {
  const negotiation = await getNegotiationById(negotiationId);

  if (role !== 'admin') {
    assertParticipant(negotiation, userId);
  }

  // Full offer history — chronological order (oldest first)
  const [history] = await pool.query(
    `SELECT
       o.offer_id,
       o.negotiation_id,
       o.user_id,
       o.offered_price,
       o.timestamp,
       u.user_name,
       u.profile_picture,
       u.role AS user_role,
       -- Label each offer so the UI can distinguish buyer vs seller moves
       CASE WHEN o.user_id = n.buyer_id THEN 'buyer' ELSE 'seller' END AS made_by
     FROM Offers o
     JOIN User u        ON o.user_id       = u.user_id
     JOIN Negotiation n ON o.negotiation_id = n.negotiation_id
     WHERE o.negotiation_id = ?
     ORDER BY o.timestamp ASC, o.offer_id ASC`,
    [negotiationId]
  );

  // Identify the accepted offer (last offer when status is accepted)
  let acceptedOffer = null;
  if (
    negotiation.status === NEGOTIATION_STATUS.ACCEPTED &&
    history.length > 0
  ) {
    acceptedOffer = history[history.length - 1];
  }

  return { negotiation, history, acceptedOffer };
};

/**
 * If a book has no remaining active negotiations, set it back to 'available'.
 * Called after a negotiation is rejected or cancelled.
 *
 * @param {number} bookId
 */
const releaseBookIfFree = async (bookId) => {
  const [active] = await pool.query(
    `SELECT negotiation_id FROM Negotiation
     WHERE book_id = ? AND status = ?
     LIMIT 1`,
    [bookId, NEGOTIATION_STATUS.ACTIVE]
  );

  if (active.length === 0) {
    // No remaining active negotiations — make book available again
    await pool.query(
      `UPDATE Book SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE book_id = ?`,
      [BOOK_STATUS.AVAILABLE, bookId]
    );
  }
};

module.exports = {
  createNegotiation,
  getUserNegotiations,
  getNegotiationDetails,
  createOffer,
  acceptOffer,
  rejectNegotiation,
  cancelNegotiation,
  getNegotiationHistory,
};
