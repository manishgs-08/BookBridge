/**
 * Negotiation Controller
 * Handles HTTP requests for all negotiation and offer endpoints.
 * Delegates all business logic to negotiationService.
 */

const negotiationService = require('../services/negotiationService');
const { success } = require('../utils/responseHelper');

/**
 * Create a new negotiation
 * @route POST /api/negotiations
 * @access Private (any authenticated user)
 */
const createNegotiation = async (req, res, next) => {
  try {
    const buyerId = req.user.user_id;
    const { bookId, offeredPrice } = req.body;

    const result = await negotiationService.createNegotiation(
      buyerId,
      bookId,
      offeredPrice
    );

    return success(
      res,
      'Negotiation started successfully',
      result,
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get all negotiations for the logged-in user
 * @route GET /api/negotiations
 * @access Private
 */
const getUserNegotiations = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const role   = req.user.role;

    const negotiations = await negotiationService.getUserNegotiations(userId, role);

    return success(res, 'Negotiations retrieved successfully', { negotiations });
  } catch (err) {
    next(err);
  }
};

/**
 * Get full details of a single negotiation
 * @route GET /api/negotiations/:id
 * @access Private (participants only)
 */
const getNegotiationDetails = async (req, res, next) => {
  try {
    const negotiationId = req.params.id;
    const userId        = req.user.user_id;
    const role          = req.user.role;

    const negotiation = await negotiationService.getNegotiationDetails(
      negotiationId,
      userId,
      role
    );

    return success(res, 'Negotiation retrieved successfully', { negotiation });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new offer in a negotiation (initial offer or counteroffer)
 * @route POST /api/negotiations/:id/offers
 * @access Private (participants only)
 */
const createOffer = async (req, res, next) => {
  try {
    const negotiationId = req.params.id;
    const userId        = req.user.user_id;
    const { offeredPrice } = req.body;

    const offer = await negotiationService.createOffer(
      negotiationId,
      userId,
      offeredPrice
    );

    return success(res, 'Offer submitted successfully', { offer }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Accept the latest offer — creates agreement record (Transaction)
 * @route PUT /api/negotiations/:id/accept
 * @access Private (participants only)
 */
const acceptOffer = async (req, res, next) => {
  try {
    const negotiationId = req.params.id;
    const userId        = req.user.user_id;

    const result = await negotiationService.acceptOffer(negotiationId, userId);

    return success(res, 'Offer accepted. Agreement recorded.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Reject the current negotiation
 * @route PUT /api/negotiations/:id/reject
 * @access Private (participants only)
 */
const rejectNegotiation = async (req, res, next) => {
  try {
    const negotiationId = req.params.id;
    const userId        = req.user.user_id;

    const negotiation = await negotiationService.rejectNegotiation(
      negotiationId,
      userId
    );

    return success(res, 'Negotiation rejected', { negotiation });
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel a negotiation (withdraw from it)
 * @route PUT /api/negotiations/:id/cancel
 * @access Private (participants only)
 */
const cancelNegotiation = async (req, res, next) => {
  try {
    const negotiationId = req.params.id;
    const userId        = req.user.user_id;

    const negotiation = await negotiationService.cancelNegotiation(
      negotiationId,
      userId
    );

    return success(res, 'Negotiation cancelled', { negotiation });
  } catch (err) {
    next(err);
  }
};

/**
 * Get full offer/counteroffer history for a negotiation
 * @route GET /api/negotiations/:id/history
 * @access Private (participants only)
 */
const getNegotiationHistory = async (req, res, next) => {
  try {
    const negotiationId = req.params.id;
    const userId        = req.user.user_id;
    const role          = req.user.role;

    const result = await negotiationService.getNegotiationHistory(
      negotiationId,
      userId,
      role
    );

    return success(res, 'Negotiation history retrieved successfully', result);
  } catch (err) {
    next(err);
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
