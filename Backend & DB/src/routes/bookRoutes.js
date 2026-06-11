const express = require('express');
const bookController = require('../controllers/bookController');
const { verifyJWT, requireVerifiedSeller } = require('../middleware/auth');
const { validatePagination, validateIdParam, handleValidationErrors } = require('../middleware/validate');
const { body } = require('express-validator');
const { BOOK_CONDITIONS } = require('../config/constants');

const router = express.Router();

// Validation for creating/updating books
const validateBookData = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('author').trim().notEmpty().withMessage('Author is required'),
  body('condition')
    .isIn(BOOK_CONDITIONS)
    .withMessage(`Condition must be one of: ${BOOK_CONDITIONS.join(', ')}`),
  body('asking_price')
    .isFloat({ min: 0 })
    .withMessage('Asking price must be a positive number'),
  body('original_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Original price must be a positive number'),
  body('published_year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Invalid published year'),
];

/**
 * @route   GET /api/books/price-recommendation
 * @desc    Get recommended price based on condition
 * @access  Private (Verified Seller)
 */
router.get(
  '/price-recommendation',
  verifyJWT,
  requireVerifiedSeller,
  bookController.getPriceRecommendation
);

/**
 * @route   GET /api/books
 * @desc    Get all books with optional filters, search, and pagination
 * @access  Public
 */
router.get(
  '/',
  validatePagination,
  handleValidationErrors,
  bookController.getBooks
);

/**
 * @route   GET /api/books/:id
 * @desc    Get a single book by ID
 * @access  Public
 */
router.get(
  '/:id',
  validateIdParam('id'),
  handleValidationErrors,
  bookController.getBookById
);

/**
 * @route   POST /api/books
 * @desc    Create a new book listing
 * @access  Private (Verified Seller)
 */
router.post(
  '/',
  verifyJWT,
  requireVerifiedSeller,
  validateBookData,
  handleValidationErrors,
  bookController.createBook
);

/**
 * @route   PUT /api/books/:id
 * @desc    Update a book listing
 * @access  Private (Verified Seller)
 */
router.put(
  '/:id',
  verifyJWT,
  requireVerifiedSeller,
  validateIdParam('id'),
  // We make validations optional for PUT since it might be a partial update,
  // or we could use the same validateBookData but make fields optional.
  // For simplicity here, we rely on the service to filter allowed fields.
  handleValidationErrors,
  bookController.updateBook
);

/**
 * @route   DELETE /api/books/:id
 * @desc    Delete (soft remove) a book listing
 * @access  Private (Verified Seller)
 */
router.delete(
  '/:id',
  verifyJWT,
  requireVerifiedSeller,
  validateIdParam('id'),
  handleValidationErrors,
  bookController.deleteBook
);

module.exports = router;
