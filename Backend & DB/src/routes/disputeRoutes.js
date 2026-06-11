/**
 * Dispute Routes
 * Base path: /api/disputes
 */

const express = require('express');
const disputeController    = require('../controllers/disputeController');
const { verifyJWT, requireRole } = require('../middleware/auth');
const {
  validateIdParam,
  handleValidationErrors,
  validateRaiseDispute,
  validateUpdateDisputeStatus,
  validatePagination,
} = require('../middleware/validate');

const router = express.Router();

// All dispute routes require authentication
router.use(verifyJWT);

/**
 * @route   GET /api/disputes
 * @desc    Get disputes for the current user (admin sees all)
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  handleValidationErrors,
  disputeController.getUserDisputes
);

/**
 * @route   POST /api/disputes
 * @desc    Raise a new dispute on a transaction
 * @body    { transactionId: number, reason: string }
 * @access  Private (transaction participants only)
 */
router.post(
  '/',
  validateRaiseDispute,
  handleValidationErrors,
  disputeController.raiseDispute
);

/**
 * @route   GET /api/disputes/:id
 * @desc    Get details of a specific dispute
 * @access  Private (participants or admin)
 */
router.get(
  '/:id',
  validateIdParam('id'),
  handleValidationErrors,
  disputeController.getDisputeDetails
);

/**
 * @route   PUT /api/disputes/:id/status
 * @desc    Update dispute status (admin only)
 * @body    { status: 'under_review' | 'resolved' | 'dismissed' }
 * @access  Private (admin only)
 */
router.put(
  '/:id/status',
  requireRole('admin'),
  validateIdParam('id'),
  validateUpdateDisputeStatus,
  handleValidationErrors,
  disputeController.updateDisputeStatus
);

module.exports = router;
