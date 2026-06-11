/**
 * Dispute Controller
 * HTTP handlers for dispute endpoints.
 */

const disputeService = require('../services/disputeService');
const { success }    = require('../utils/responseHelper');

/**
 * Raise a dispute on a transaction
 * @route POST /api/disputes
 * @access Private (transaction participants only)
 */
const raiseDispute = async (req, res, next) => {
  try {
    const raisedBy      = req.user.user_id;
    const { transactionId, reason } = req.body;

    const dispute = await disputeService.raiseDispute(raisedBy, transactionId, reason);
    return success(res, 'Dispute raised successfully', { dispute }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get disputes for the current user (or all disputes for admin)
 * @route GET /api/disputes
 * @access Private
 */
const getUserDisputes = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const role   = req.user.role;
    const { page, limit } = req.query;

    const result = await disputeService.getUserDisputes(userId, role, page, limit);
    return success(res, 'Disputes retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get details of a single dispute
 * @route GET /api/disputes/:id
 * @access Private (participants or admin)
 */
const getDisputeDetails = async (req, res, next) => {
  try {
    const disputeId = req.params.id;
    const userId    = req.user.user_id;
    const role      = req.user.role;

    const dispute = await disputeService.getDisputeDetails(disputeId, userId, role);
    return success(res, 'Dispute retrieved successfully', { dispute });
  } catch (err) {
    next(err);
  }
};

/**
 * Update dispute status (admin only)
 * @route PUT /api/disputes/:id/status
 * @access Private (admin only)
 */
const updateDisputeStatus = async (req, res, next) => {
  try {
    const disputeId = req.params.id;
    const { status } = req.body;

    const dispute = await disputeService.updateDisputeStatus(disputeId, status);
    return success(res, 'Dispute status updated successfully', { dispute });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  raiseDispute,
  getUserDisputes,
  getDisputeDetails,
  updateDisputeStatus,
};
