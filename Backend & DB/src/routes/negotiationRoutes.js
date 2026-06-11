/**
 * Negotiation Routes
 * Mounts all endpoints for the negotiation and offer flow.
 *
 * Base path: /api/negotiations
 *
 * All routes require authentication (verifyJWT).
 * Participant enforcement and business-rule checks are handled inside the service.
 */

const express = require('express');
const negotiationController = require('../controllers/negotiationController');
const { verifyJWT } = require('../middleware/auth');
const {
  validateCreateNegotiation,
  validateCreateOffer,
  validateIdParam,
  handleValidationErrors,
} = require('../middleware/validate');

const router = express.Router();

// All negotiation routes require a valid JWT
router.use(verifyJWT);

/**
 * @route   POST /api/negotiations
 * @desc    Start a new negotiation for a book with an initial offer
 * @body    { bookId: number, offeredPrice: number }
 * @access  Private (any authenticated user — buyer role enforced in service)
 */
router.post(
  '/',
  validateCreateNegotiation,
  handleValidationErrors,
  negotiationController.createNegotiation
);

/**
 * @route   GET /api/negotiations
 * @desc    Get all negotiations involving the current user (as buyer or seller)
 * @access  Private
 */
router.get('/', negotiationController.getUserNegotiations);

/**
 * @route   GET /api/negotiations/:id
 * @desc    Get full details of a single negotiation (participants only)
 * @access  Private
 */
router.get(
  '/:id',
  validateIdParam('id'),
  handleValidationErrors,
  negotiationController.getNegotiationDetails
);

/**
 * @route   GET /api/negotiations/:id/history
 * @desc    Get the full chronological offer/counteroffer history
 * @access  Private (participants only)
 */
router.get(
  '/:id/history',
  validateIdParam('id'),
  handleValidationErrors,
  negotiationController.getNegotiationHistory
);

/**
 * @route   POST /api/negotiations/:id/offers
 * @desc    Place a new offer or counteroffer in an active negotiation
 * @body    { offeredPrice: number }
 * @access  Private (participants only)
 */
router.post(
  '/:id/offers',
  validateIdParam('id'),
  validateCreateOffer,
  handleValidationErrors,
  negotiationController.createOffer
);

/**
 * @route   PUT /api/negotiations/:id/accept
 * @desc    Accept the latest offer — records agreement (Transaction)
 * @access  Private (the party who did NOT make the last offer)
 */
router.put(
  '/:id/accept',
  validateIdParam('id'),
  handleValidationErrors,
  negotiationController.acceptOffer
);

/**
 * @route   PUT /api/negotiations/:id/reject
 * @desc    Reject / close the negotiation
 * @access  Private (participants only)
 */
router.put(
  '/:id/reject',
  validateIdParam('id'),
  handleValidationErrors,
  negotiationController.rejectNegotiation
);

/**
 * @route   PUT /api/negotiations/:id/cancel
 * @desc    Cancel / withdraw from a negotiation
 * @access  Private (participants only)
 */
router.put(
  '/:id/cancel',
  validateIdParam('id'),
  handleValidationErrors,
  negotiationController.cancelNegotiation
);

module.exports = router;
