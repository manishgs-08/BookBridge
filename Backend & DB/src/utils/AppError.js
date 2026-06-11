/**
 * Custom application error class
 * Extends native Error with HTTP status codes and operational flag
 *
 * isOperational = true  → expected errors (bad input, auth failure)
 * isOperational = false → programming bugs (should crash and restart)
 */

class AppError extends Error {
  /**
   * @param {string} message - Error message returned to the client
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = true;

    // Capture stack trace, excluding this constructor from the trace
    Error.captureStackTrace(this, this.constructor);
  }

  // Factory methods for common error types

  static badRequest(message = 'Bad request') {
    return new AppError(message, 400);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  static conflict(message = 'Conflict') {
    return new AppError(message, 409);
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500);
  }
}

module.exports = AppError;
