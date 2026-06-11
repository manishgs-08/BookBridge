/**
 * Request Service
 * Business logic for the Book Request Board.
 *
 * BookRequest — a post by a student describing a book they need.
 * RequestResponse — a seller expressing interest in fulfilling the request.
 *
 * Design:
 * - Any authenticated user can create a request.
 * - Only the request owner can update/delete it.
 * - Only verified sellers can respond to requests.
 * - A seller can respond to the same request only once (unique constraint).
 * - All DB operations use parameterized queries.
 */

const { pool } = require('../config/db');
const AppError  = require('../utils/AppError');
const { REQUEST_STATUS, BOOK_STATUS, PAGINATION } = require('../config/constants');
const { createNotification } = require('./notificationService');

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Fetch a single request by ID with requester details.
 * Throws 404 if not found.
 *
 * @param {number} requestId
 * @returns {Object}
 */
const getRequestById = async (requestId) => {
  const [rows] = await pool.query(
    `SELECT
       r.request_id,
       r.user_id,
       r.title,
       r.author,
       r.isbn,
       r.category,
       r.semester,
       r.branch,
       r.max_budget,
       r.description,
       r.status,
       r.created_at,
       r.updated_at,
       u.user_name       AS requester_name,
       u.profile_picture AS requester_picture
     FROM BookRequest r
     JOIN User u ON r.user_id = u.user_id
     WHERE r.request_id = ?`,
    [requestId]
  );

  if (rows.length === 0) {
    throw AppError.notFound('Book request not found');
  }

  return rows[0];
};

// ─── Public Service Methods ────────────────────────────────────────────────

/**
 * Create a new book request.
 *
 * @param {number} userId
 * @param {Object} data
 * @returns {Object} Created request
 */
const createRequest = async (userId, data) => {
  const {
    title,
    author,
    isbn,
    category,
    semester,
    branch,
    max_budget,
    description,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO BookRequest
       (user_id, title, author, isbn, category, semester, branch, max_budget, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      title,
      author      || null,
      isbn        || null,
      category    || null,
      semester    || null,
      branch      || null,
      max_budget  || null,
      description || null,
      REQUEST_STATUS.OPEN,
    ]
  );

  return getRequestById(result.insertId);
};

/**
 * Get all book requests with optional filtering, search, and pagination.
 *
 * @param {Object} filters
 * @returns {Object} { requests, pagination }
 */
const getRequests = async (filters) => {
  const {
    q,
    category,
    semester,
    branch,
    status = REQUEST_STATUS.OPEN,
    page   = PAGINATION.DEFAULT_PAGE,
    limit  = PAGINATION.DEFAULT_LIMIT,
  } = filters;

  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  let whereClauses = ['r.status = ?'];
  let params       = [status];

  // Simple LIKE search across title, author, description
  if (q) {
    whereClauses.push('(r.title LIKE ? OR r.author LIKE ? OR r.description LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  if (category) {
    whereClauses.push('r.category = ?');
    params.push(category);
  }

  if (semester) {
    whereClauses.push('r.semester = ?');
    params.push(parseInt(semester, 10));
  }

  if (branch) {
    whereClauses.push('r.branch = ?');
    params.push(branch);
  }

  const where = `WHERE ${whereClauses.join(' AND ')}`;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM BookRequest r ${where}`,
    params
  );

  const total = countRows[0].total;

  const [requests] = await pool.query(
    `SELECT
       r.request_id,
       r.user_id,
       r.title,
       r.author,
       r.isbn,
       r.category,
       r.semester,
       r.branch,
       r.max_budget,
       r.description,
       r.status,
       r.created_at,
       r.updated_at,
       u.user_name       AS requester_name,
       u.profile_picture AS requester_picture,
       (SELECT COUNT(*) FROM RequestResponse rr WHERE rr.request_id = r.request_id) AS response_count
     FROM BookRequest r
     JOIN User u ON r.user_id = u.user_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    params
  );

  return {
    requests,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: queryLimit,
      totalPages: Math.ceil(total / queryLimit),
    },
  };
};

/**
 * Get full details of a single request, including all responses.
 *
 * @param {number} requestId
 * @returns {Object} { request, responses }
 */
const getRequestDetails = async (requestId) => {
  const request = await getRequestById(requestId);

  const [responses] = await pool.query(
    `SELECT
       rr.response_id,
       rr.request_id,
       rr.seller_id,
       rr.message,
       rr.book_id,
       rr.created_at,
       u.user_name       AS seller_name,
       u.profile_picture AS seller_picture,
       b.title           AS linked_book_title,
       b.asking_price    AS linked_book_price,
       b.status          AS linked_book_status,
       b.image_url       AS linked_book_image
     FROM RequestResponse rr
     JOIN User u        ON rr.seller_id = u.user_id
     LEFT JOIN Book b   ON rr.book_id   = b.book_id
     WHERE rr.request_id = ?
     ORDER BY rr.created_at ASC`,
    [requestId]
  );

  return { request, responses };
};

/**
 * Update a book request. Owner only.
 *
 * @param {number} requestId
 * @param {number} userId
 * @param {Object} updateData
 * @returns {Object} Updated request
 */
const updateRequest = async (requestId, userId, updateData) => {
  const request = await getRequestById(requestId);

  if (request.user_id !== userId) {
    throw AppError.forbidden('You can only edit your own book requests');
  }

  // Cannot edit a fulfilled or closed request
  if (request.status !== REQUEST_STATUS.OPEN) {
    throw AppError.badRequest(
      `Cannot edit a request that is already ${request.status}`
    );
  }

  const allowedFields = [
    'title', 'author', 'isbn', 'category', 'semester',
    'branch', 'max_budget', 'description', 'status',
  ];

  const updateFields = [];
  const params       = [];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      params.push(updateData[field]);
    }
  }

  if (updateFields.length === 0) {
    return request; // Nothing to update — idempotent
  }

  params.push(requestId);

  await pool.query(
    `UPDATE BookRequest SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
    params
  );

  return getRequestById(requestId);
};

/**
 * Delete a book request. Owner only.
 * Uses hard delete (no soft-delete needed for requests).
 *
 * @param {number} requestId
 * @param {number} userId
 * @returns {{ message: string }}
 */
const deleteRequest = async (requestId, userId) => {
  const request = await getRequestById(requestId);

  if (request.user_id !== userId) {
    throw AppError.forbidden('You can only delete your own book requests');
  }

  await pool.query('DELETE FROM BookRequest WHERE request_id = ?', [requestId]);

  return { message: 'Book request deleted successfully' };
};

/**
 * Seller responds to a book request.
 *
 * Rules:
 * - Only verified sellers can respond.
 * - Request must be open.
 * - Seller cannot respond to their own request (if they posted one as a buyer).
 * - A seller can respond to the same request only once (unique constraint in DB).
 * - Optionally link a specific book listing they have for sale.
 *
 * @param {number} requestId
 * @param {number} sellerId
 * @param {string} message
 * @param {number|null} bookId - Optional linked book listing
 * @returns {Object} Created response
 */
const respondToRequest = async (requestId, sellerId, message, bookId = null) => {
  const request = await getRequestById(requestId);

  if (request.status !== REQUEST_STATUS.OPEN) {
    throw AppError.badRequest(
      `Cannot respond to a request that is already ${request.status}`
    );
  }

  // Seller cannot respond to their own request
  if (request.user_id === sellerId) {
    throw AppError.forbidden('You cannot respond to your own book request');
  }

  // If linking a book, verify ownership
  if (bookId !== null) {
    const [bookRows] = await pool.query(
      'SELECT book_id, seller_id, status FROM Book WHERE book_id = ?',
      [bookId]
    );

    if (bookRows.length === 0) {
      throw AppError.notFound('Linked book not found');
    }

    if (bookRows[0].seller_id !== sellerId) {
      throw AppError.forbidden('You can only link your own book listings');
    }

    if (bookRows[0].status !== BOOK_STATUS.AVAILABLE) {
      throw AppError.badRequest('Linked book must be available');
    }
  }

  // Check for duplicate response (friendly message before DB throws ER_DUP_ENTRY)
  const [existing] = await pool.query(
    'SELECT response_id FROM RequestResponse WHERE seller_id = ? AND request_id = ?',
    [sellerId, requestId]
  );

  if (existing.length > 0) {
    throw AppError.conflict('You have already responded to this request');
  }

  const [result] = await pool.query(
    `INSERT INTO RequestResponse (request_id, seller_id, message, book_id)
     VALUES (?, ?, ?, ?)`,
    [requestId, sellerId, message, bookId]
  );

  const [responseRows] = await pool.query(
    `SELECT
       rr.response_id, rr.request_id, rr.seller_id, rr.message, rr.book_id, rr.created_at,
       u.user_name AS seller_name, u.profile_picture AS seller_picture,
       b.title     AS linked_book_title,
       b.asking_price AS linked_book_price
     FROM RequestResponse rr
     JOIN User u      ON rr.seller_id = u.user_id
     LEFT JOIN Book b ON rr.book_id   = b.book_id
     WHERE rr.response_id = ?`,
    [result.insertId]
  );

  const responseData = responseRows[0];

  // Send notification to the request owner
  await createNotification(
    request.user_id,
    'request_response',
    `${responseData.seller_name} responded to your book request for "${request.title}"`,
    result.insertId,
    'request_response'
  );

  return responseData;
};

module.exports = {
  createRequest,
  getRequests,
  getRequestDetails,
  updateRequest,
  deleteRequest,
  respondToRequest,
};
