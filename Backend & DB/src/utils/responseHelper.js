/**
 * Standardized API response helpers
 *
 * Success: { success: true, message: "...", data: {...} }
 * Error:   { success: false, message: "..." }
 */

/**
 * Send a success response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {*} data - Response payload
 * @param {number} statusCode - HTTP status (default 200)
 */
const success = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} statusCode - HTTP status (default 500)
 */
const error = (res, message, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = { success, error };
