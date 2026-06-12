/**
 * Book Service
 * Handles business logic for book listings, search, filtering, and price recommendations
 */

const { pool } = require('../config/db');
const { PRICE_MULTIPLIERS, BOOK_STATUS, PAGINATION } = require('../config/constants');
const AppError = require('../utils/AppError');

/**
 * Map database book object to frontend book object structure
 */
const mapBookToFrontend = (book) => {
  if (!book) return null;
  return {
    _id: String(book.book_id),
    title: book.title,
    author: book.author,
    description: book.description || '',
    isbn: book.isbn || '',
    category: book.category || '',
    semester: book.semester,
    branch: book.branch,
    condition: book.condition,
    price: Number(book.asking_price),
    type: book.type || 'Sell',
    exchangeFor: book.exchange_for || '',
    image: book.image_url || '',
    status: book.status === 'available' ? 'Available' : 
            book.status === 'reserved' ? 'Reserved' : 
            book.status === 'sold' ? 'Sold' : 'Removed',
    owner: {
      _id: String(book.seller_id),
      name: book.seller_name || '',
      email: book.seller_email || '',
      rating: book.seller_rating ? Number(book.seller_rating) : 5.0,
      profilePicture: book.seller_picture,
      sellerVerified: !!book.seller_verified,
    },
    createdAt: book.created_at,
    updatedAt: book.updated_at,
  };
};

/**
 * Map frontend book data to database fields
 */
const mapFrontendBookToBackend = (data) => {
  let condition = data.condition || 'Good';
  if (condition === 'New') {
    condition = 'Like New';
  }

  return {
    title: data.title,
    author: data.author,
    description: data.description || null,
    isbn: data.isbn || null,
    category: data.category || null,
    semester: data.semester ? parseInt(data.semester, 10) : null,
    branch: data.branch || null,
    condition: condition,
    original_price: data.originalPrice ? parseFloat(data.originalPrice) : (data.original_price ? parseFloat(data.original_price) : null),
    asking_price: data.price !== undefined ? parseFloat(data.price) : (data.asking_price !== undefined ? parseFloat(data.asking_price) : 0),
    published_year: data.publishedYear ? parseInt(data.publishedYear, 10) : (data.published_year ? parseInt(data.published_year, 10) : null),
    image_url: data.image || data.image_url || null,
    type: data.type || 'Sell',
    exchange_for: data.exchangeFor || data.exchange_for || null,
  };
};

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
 * @param {Object} rawBookData
 * @returns {Object} Created book
 */
const createBook = async (sellerId, rawBookData) => {
  const bookData = mapFrontendBookToBackend(rawBookData);
  
  const [result] = await pool.query(
    `INSERT INTO Book 
      (seller_id, title, author, description, isbn, category, semester, branch, 
       \`condition\`, original_price, asking_price, published_year, image_url, type, exchange_for, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sellerId,
      bookData.title,
      bookData.author,
      bookData.description,
      bookData.isbn,
      bookData.category,
      bookData.semester,
      bookData.branch,
      bookData.condition,
      bookData.original_price,
      bookData.asking_price,
      bookData.published_year,
      bookData.image_url,
      bookData.type,
      bookData.exchange_for,
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
    search,
    category,
    condition,
    semester,
    branch,
    type,
    minPrice,
    maxPrice,
    status = 'All Books',
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
  } = filters;

  const searchQuery = q || search;
  const queryLimit = Math.min(parseInt(limit, 10), PAGINATION.MAX_LIMIT);
  const offset = (parseInt(page, 10) - 1) * queryLimit;

  let whereClauses = [];
  let queryParams = [];

  if (status === 'All Books') {
    whereClauses.push("b.status IN ('available', 'reserved', 'sold')");
  } else {
    // Map Frontend status text to DB enum
    let dbStatus = BOOK_STATUS.AVAILABLE;
    if (status === 'Reserved') dbStatus = 'reserved';
    if (status === 'Sold') dbStatus = 'sold';
    
    whereClauses.push('b.status = ?');
    queryParams.push(dbStatus);
  }

  // Search
  if (searchQuery) {
    whereClauses.push('(b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)');
    const like = `%${searchQuery}%`;
    queryParams.push(like, like, like);
  }

  // Exact filters
  if (category && category !== 'All Categories') {
    whereClauses.push('b.category = ?');
    queryParams.push(category);
  }
  if (condition && condition !== 'All Conditions') {
    let checkCondition = condition;
    if (condition === 'New') checkCondition = 'Like New';
    whereClauses.push('b.`condition` = ?');
    queryParams.push(checkCondition);
  }
  if (semester) {
    whereClauses.push('b.semester = ?');
    queryParams.push(parseInt(semester, 10));
  }
  if (branch) {
    whereClauses.push('b.branch = ?');
    queryParams.push(branch);
  }
  if (type) {
    whereClauses.push('b.type = ?');
    queryParams.push(type);
  }

  // Price range filters
  if (minPrice) {
    whereClauses.push('b.asking_price >= ?');
    queryParams.push(parseFloat(minPrice));
  }
  if (maxPrice) {
    whereClauses.push('b.asking_price <= ?');
    queryParams.push(parseFloat(maxPrice));
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count for pagination
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM Book b ${whereString}`,
    queryParams
  );
  const total = countResult[0].total;

  // Get paginated results
  const [books] = await pool.query(
    `SELECT b.*, u.user_name as seller_name, u.profile_picture as seller_picture, u.seller_verified, u.email as seller_email,
     (SELECT AVG(rating) FROM Review WHERE reviewed_user_id = b.seller_id) as seller_rating
     FROM Book b
     JOIN User u ON b.seller_id = u.user_id
     ${whereString}
     ORDER BY b.created_at DESC
     LIMIT ${parseInt(queryLimit, 10)} OFFSET ${parseInt(offset, 10)}`,
    queryParams
  );

  return {
    books: books.map(mapBookToFrontend),
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
    `SELECT b.*, u.user_name as seller_name, u.profile_picture as seller_picture, u.seller_verified, u.email as seller_email,
     (SELECT AVG(rating) FROM Review WHERE reviewed_user_id = b.seller_id) as seller_rating
     FROM Book b
     JOIN User u ON b.seller_id = u.user_id
     WHERE b.book_id = ?`,
    [bookId]
  );

  if (books.length === 0) {
    throw AppError.notFound('Book not found');
  }

  return mapBookToFrontend(books[0]);
};

/**
 * Retrieve user's own inventory
 *
 * @param {number} userId
 * @returns {Object[]}
 */
const getMyInventory = async (userId) => {
  const [books] = await pool.query(
    `SELECT b.*, u.user_name as seller_name, u.profile_picture as seller_picture, u.seller_verified, u.email as seller_email,
     (SELECT AVG(rating) FROM Review WHERE reviewed_user_id = b.seller_id) as seller_rating
     FROM Book b
     JOIN User u ON b.seller_id = u.user_id
     WHERE b.seller_id = ? AND b.status != 'removed'
     ORDER BY b.created_at DESC`,
    [userId]
  );

  return books.map(mapBookToFrontend);
};

/**
 * Update an existing book listing
 *
 * @param {number} bookId
 * @param {number} userId (Current logged-in user)
 * @param {Object} rawUpdateData
 * @param {string} userRole (Role of the current user)
 * @returns {Object} Updated book
 */
const updateBook = async (bookId, userId, rawUpdateData, userRole) => {
  // First ensure the book exists and the user is authorized to edit it
  const book = await getBookById(bookId);

  // Only the seller or an admin can update the book
  if (Number(book.owner._id) !== userId && userRole !== 'admin') {
    throw AppError.forbidden('You are not authorized to update this listing');
  }

  // Prevent updates to books that are already sold/reserved unless explicitly allowed
  if ((book.status === 'Sold' || book.status === 'Pending') && userRole !== 'admin') {
    if (rawUpdateData.status && rawUpdateData.status !== BOOK_STATUS.AVAILABLE) {
      throw AppError.forbidden('Cannot modify a book that is currently reserved or sold');
    }
  }

  const mappedData = mapFrontendBookToBackend(rawUpdateData);

  // Fields allowed to be updated in DB
  const allowedFields = [
    'title', 'author', 'description', 'isbn', 'category', 'semester',
    'branch', 'condition', 'original_price', 'asking_price', 'published_year',
    'image_url', 'type', 'exchange_for', 'status'
  ];

  const updateFields = [];
  const queryParams = [];

  for (const field of allowedFields) {
    if (mappedData[field] !== undefined) {
      updateFields.push(`\`${field}\` = ?`);
      queryParams.push(mappedData[field]);
    } else if (field === 'status' && rawUpdateData.status !== undefined) {
      // Map status back to database enum values
      const statusMap = {
        'Available': 'available',
        'Pending': 'reserved',
        'Sold': 'sold',
      };
      const dbStatus = statusMap[rawUpdateData.status] || rawUpdateData.status;
      updateFields.push('`status` = ?');
      queryParams.push(dbStatus);
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

  if (Number(book.owner._id) !== userId && userRole !== 'admin') {
    throw AppError.forbidden('You are not authorized to delete this listing');
  }

  if (book.status === 'Sold' || book.status === 'Pending') {
    throw AppError.forbidden('Cannot delete a book that is currently reserved or sold');
  }

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
  getMyInventory,
  updateBook,
  deleteBook,
  mapBookToFrontend,
  mapFrontendBookToBackend,
};
