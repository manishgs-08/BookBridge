/**
 * Request Controller
 * HTTP handlers for Book Request Board endpoints.
 */

const requestService = require('../services/requestService');
const { success }    = require('../utils/responseHelper');

/**
 * Create a new book request
 * @route POST /api/requests
 * @access Private
 */
const createRequest = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const data   = req.body;

    const request = await requestService.createRequest(userId, data);
    return success(res, 'Book request created successfully', { request }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get all book requests (with optional filters, search, pagination)
 * @route GET /api/requests
 * @access Private
 */
const getRequests = async (req, res, next) => {
  try {
    const filters = req.query;
    const result  = await requestService.getRequests(filters);
    return success(res, 'Book requests retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get full details of a single book request (incl. responses)
 * @route GET /api/requests/:id
 * @access Private
 */
const getRequestDetails = async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const result    = await requestService.getRequestDetails(requestId);
    return success(res, 'Book request retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Update a book request
 * @route PUT /api/requests/:id
 * @access Private (owner only)
 */
const updateRequest = async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const userId    = req.user.user_id;
    const updateData = req.body;

    const request = await requestService.updateRequest(requestId, userId, updateData);
    return success(res, 'Book request updated successfully', { request });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a book request
 * @route DELETE /api/requests/:id
 * @access Private (owner only)
 */
const deleteRequest = async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const userId    = req.user.user_id;

    const result = await requestService.deleteRequest(requestId, userId);
    return success(res, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * Seller responds to a book request
 * @route POST /api/requests/:id/respond
 * @access Private (verified sellers only)
 */
const respondToRequest = async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const sellerId  = req.user.user_id;
    const { message, bookId = null } = req.body;

    const response = await requestService.respondToRequest(
      requestId,
      sellerId,
      message,
      bookId
    );

    return success(res, 'Response submitted successfully', { response }, 201);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRequest,
  getRequests,
  getRequestDetails,
  updateRequest,
  deleteRequest,
  respondToRequest,
};
