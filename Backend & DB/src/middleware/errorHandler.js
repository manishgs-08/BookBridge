/**
 * Global Error Handler Middleware
 *
 * Catches all errors passed via next(err) and returns a consistent
 * JSON response in the approved format: { success: false, message: "..." }
 *
 * Handles:
 * - AppError (operational errors)
 * - JWT errors (expired, malformed)
 * - MySQL errors (duplicate key, FK constraint)
 * - Unknown errors (500)
 */

const AppError = require('../utils/AppError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Default to 500 if no status code is set
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // ─── JWT Errors ─────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired';
  }

  // ─── MySQL Errors ───────────────────────────────────────
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Duplicate entry. This record already exists.';
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 409;
    message = 'Cannot delete. This record is referenced by other records.';
  }

  // ─── Validation Errors (express-validator) ──────────────
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  }

  // ─── Log error in development ───────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    console.error('─── Error ───');
    console.error('Status:', statusCode);
    console.error('Message:', message);
    if (!err.isOperational) {
      console.error('Stack:', err.stack);
    }
  } else {
    // In production, log all errors but hide internal details from client
    if (!err.isOperational) {
      console.error('Unexpected error:', err);
      message = 'Internal server error';
      statusCode = 500;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
