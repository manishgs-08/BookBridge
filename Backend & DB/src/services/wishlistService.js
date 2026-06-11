/**
 * Wishlist Service
 * Business logic for saving and managing a user's book wishlist.
 *
 * Design:
 * - Unique constraint (uk_user_book) in DB prevents duplicate saves.
 * - Removing a book that isn't in the wishlist returns a 404 (not silent).
 * - All DB operations use parameterized queries.
 */

const { pool } = require('../config/db');
const AppError  = require('../utils/AppError');

// ─── Public Service Methods ────────────────────────────────────────────────

/**
 * Add a book to the user's wishlist.
 *
 * Rules:
 * - Book must exist.
 * - A user cannot wishlist a book twice (unique constraint enforced at DB level;
 *   we pre-check for a clear error message).
 *
 * @param {number} userId
 * @param {number} bookId
 * @returns {Object} Wishlist entry with book details
 */
const addToWishlist = async (userId, bookId) => {
  // Verify the book exists and is not removed
  const [bookRows] = await pool.query(
    `SELECT book_id, title, author, asking_price, status, image_url
     FROM Book WHERE book_id = ? AND status != 'removed'`,
    [bookId]
  );

  if (bookRows.length === 0) {
    throw AppError.notFound('Book not found or no longer available');
  }

  // Check for duplicate before insert to return a friendly message
  const [existing] = await pool.query(
    'SELECT wishlist_id FROM Wishlist WHERE user_id = ? AND book_id = ?',
    [userId, bookId]
  );

  if (existing.length > 0) {
    throw AppError.conflict('This book is already in your wishlist');
  }

  const [result] = await pool.query(
    'INSERT INTO Wishlist (user_id, book_id) VALUES (?, ?)',
    [userId, bookId]
  );

  // Return full entry with book details
  const [entryRows] = await pool.query(
    `SELECT
       w.wishlist_id,
       w.user_id,
       w.book_id,
       w.created_at,
       b.title,
       b.author,
       b.asking_price,
       b.status       AS book_status,
       b.image_url,
       b.\`condition\`,
       seller.user_name AS seller_name
     FROM Wishlist w
     JOIN Book b      ON w.book_id   = b.book_id
     JOIN User seller ON b.seller_id = seller.user_id
     WHERE w.wishlist_id = ?`,
    [result.insertId]
  );

  return entryRows[0];
};

/**
 * Get all wishlist entries for a user, with full book details.
 *
 * @param {number} userId
 * @returns {Object[]}
 */
const getWishlist = async (userId) => {
  const [rows] = await pool.query(
    `SELECT
       w.wishlist_id,
       w.user_id,
       w.book_id,
       w.created_at,
       b.title,
       b.author,
       b.asking_price,
       b.status       AS book_status,
       b.image_url,
       b.\`condition\`,
       b.semester,
       b.branch,
       b.category,
       seller.user_name       AS seller_name,
       seller.profile_picture AS seller_picture,
       seller.seller_verified AS seller_verified
     FROM Wishlist w
     JOIN Book b      ON w.book_id   = b.book_id
     JOIN User seller ON b.seller_id = seller.user_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC`,
    [userId]
  );

  return rows;
};

/**
 * Remove a book from the user's wishlist.
 * Throws 404 if the entry doesn't exist (so the client knows it wasn't there).
 *
 * @param {number} userId
 * @param {number} bookId
 * @returns {{ message: string }}
 */
const removeFromWishlist = async (userId, bookId) => {
  const [existing] = await pool.query(
    'SELECT wishlist_id FROM Wishlist WHERE user_id = ? AND book_id = ?',
    [userId, bookId]
  );

  if (existing.length === 0) {
    throw AppError.notFound('This book is not in your wishlist');
  }

  await pool.query(
    'DELETE FROM Wishlist WHERE user_id = ? AND book_id = ?',
    [userId, bookId]
  );

  return { message: 'Book removed from wishlist' };
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
};
