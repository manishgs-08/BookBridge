/**
 * Book Service
 * Handles business logic for book listings, search, filtering, and price recommendations
 */

const { pool } = require('../config/db');
const { PRICE_MULTIPLIERS, BOOK_STATUS, PAGINATION } = require('../config/constants');
const AppError = require('../utils/AppError');

/**
 * Calculate recommended price based on original price and condition
 *
 * @param {number} originalPrice
 * @param {string} condition
 * @returns {number} Recommended price
 */
const calculateRecommendedPrice = (originalPrice, condition) => {
  const multiplier = PRICE_MULTIPLIERS[condition];
  if (!multiplier || !originalPrice || originalPrice <= 0) {
    return 0;
  }
  return Math.round(originalPrice * multiplier * 100) / 100; // Round to 2 decimal places
};

/**
 * Get price recommendation for a book
 *
 * @param {Object} data { originalPrice, condition }
 * @returns {Object} { recommendedPrice }
 */
const getPriceRecommendation = (data) => {
  const { originalPrice, condition } = data;
  const recommendedPrice = calculateRecommendedPrice(originalPrice, condition);
  return { recommendedPrice, condition, originalPrice };
};

/**
 * Create a new book listing
 *
 * @param {number} sellerId
 * @param {Object} bookData
 * @returns {Object} Created book
 */
const createBook = async (sellerId, bookData) => {
  const {
    title,
    author,
    description,
    isbn,
    category,
    semester,
    branch,
    condition,
    original_price,
    asking_price,
    published_year,
    image_url,
  } = bookData;

  const [result] = await pool.query(
    `INSERT INTO Book 
      (seller_id, title, author, description, isbn, category, semester, branch, 
       \`condition\`, original_price, asking_price, published_year, image_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sellerId,
      title,
      author,
      description || null,
      isbn || null,
      category || null,
      semester || null,
      branch || null,
      condition,
      original_price || null,
      asking_price,
      published_year || null,
      image_url || null,
      BOOK_STATUS.AVAILABLE,
    ]
  );

  return getBookById(result.insertId);
};

/**
 * Retrieve books with search, filtering, and pagination
 *
 * @param {Object} filters Query parameters
 * @returns {Object} { books, pagination }
 */
const getBooks = async (filters) => {
  const {
    q,
    category,
    condition,
    semester,
    branch,
    minPrice,
    maxPrice,
    status = BOOK_STATUS.AVAILABLE,
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
  } = filters;

  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  let whereClauses = ['status = ?'];
  let queryParams = [status];

  // Full-text search
  if (q) {
    whereClauses.push('MATCH(title, author, description) AGAINST(? IN BOOLEAN MODE)');
    // Add * wildcard to the end of the query terms for partial matching
    const searchTerms = q.split(' ').map(term => `${term}*`).join(' ');
    queryParams.push(searchTerms);
  }

  // Exact filters
  if (category) {
    whereClauses.push('category = ?');
    queryParams.push(category);
  }
  if (condition) {
    whereClauses.push('\`condition\` = ?');
    queryParams.push(condition);
  }
  if (semester) {
    whereClauses.push('semester = ?');
    queryParams.push(parseInt(semester, 10));
  }
  if (branch) {
    whereClauses.push('branch = ?');
    queryParams.push(branch);
  }

  // Price range filters
  if (minPrice) {
    whereClauses.push('asking_price >= ?');
    queryParams.push(parseFloat(minPrice));
  }
  if (maxPrice) {
    whereClauses.push('asking_price <= ?');
    queryParams.push(parseFloat(maxPrice));
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count for pagination
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM Book ${whereString}`,
    queryParams
  );
  const total = countResult[0].total;

  // Get paginated results
  // We use string concatenation for LIMIT/OFFSET because parameterizing them can cause issues in some MySQL setups
  const [books] = await pool.query(
    `SELECT b.*, u.user_name as seller_name, u.profile_picture as seller_picture, u.seller_verified
     FROM Book b
     JOIN User u ON b.seller_id = u.user_id
     ${whereString}
     ORDER BY b.created_at DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    queryParams
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
 * Get a single book by ID
 *
 * @param {number} bookId
 * @returns {Object} Book data with seller details
 */
const getBookById = async (bookId) => {
  const [books] = await pool.query(
    `SELECT b.*, u.user_name as seller_name, u.profile_picture as seller_picture, u.seller_verified
     FROM Book b
     JOIN User u ON b.seller_id = u.user_id
     WHERE b.book_id = ?`,
    [bookId]
  );

  if (books.length === 0) {
    throw AppError.notFound('Book not found');
  }

  return books[0];
};

/**
 * Update an existing book listing
 *
 * @param {number} bookId
 * @param {number} userId (Current logged-in user)
 * @param {Object} updateData
 * @param {string} userRole (Role of the current user)
 * @returns {Object} Updated book
 */
const updateBook = async (bookId, userId, updateData, userRole) => {
  // First ensure the book exists and the user is authorized to edit it
  const book = await getBookById(bookId);

  // Only the seller or an admin can update the book
  if (book.seller_id !== userId && userRole !== 'admin') {
    throw AppError.forbidden('You are not authorized to update this listing');
  }

  // Prevent updates to books that are already sold/reserved unless explicitly allowed
  // Admins can bypass this
  if ((book.status === BOOK_STATUS.SOLD || book.status === BOOK_STATUS.RESERVED) && userRole !== 'admin') {
    // Check if the update is only changing the status back to available (e.g. cancelled transaction)
    if (updateData.status && updateData.status !== BOOK_STATUS.AVAILABLE) {
      throw AppError.forbidden('Cannot modify a book that is currently reserved or sold');
    }
  }

  // Fields allowed to be updated
  const allowedFields = [
    'title', 'author', 'description', 'isbn', 'category', 'semester',
    'branch', 'condition', 'original_price', 'asking_price', 'published_year',
    'image_url', 'status'
  ];

  const updateFields = [];
  const queryParams = [];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      // Need backticks for reserved words like condition
      updateFields.push(`\`${field}\` = ?`);
      queryParams.push(updateData[field]);
    }
  }

  if (updateFields.length === 0) {
    return book; // Nothing to update
  }

  queryParams.push(bookId);

  await pool.query(
    `UPDATE Book SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE book_id = ?`,
    queryParams
  );

  return getBookById(bookId);
};

/**
 * Delete a book listing (Soft delete by changing status to 'removed')
 *
 * @param {number} bookId
 * @param {number} userId
 * @param {string} userRole
 */
const deleteBook = async (bookId, userId, userRole) => {
  const book = await getBookById(bookId);

  if (book.seller_id !== userId && userRole !== 'admin') {
    throw AppError.forbidden('You are not authorized to delete this listing');
  }

  if (book.status === BOOK_STATUS.SOLD || book.status === BOOK_STATUS.RESERVED) {
    throw AppError.forbidden('Cannot delete a book that is currently reserved or sold');
  }

  // We do a soft delete by setting status to removed.
  // This preserves the record for historical references if needed.
  await pool.query(
    `UPDATE Book SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE book_id = ?`,
    [BOOK_STATUS.REMOVED, bookId]
  );

  return { message: 'Book listing removed successfully' };
};

module.exports = {
  getPriceRecommendation,
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
};
