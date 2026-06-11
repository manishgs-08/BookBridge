/**
 * Notification Routes
 * Base path: /api/notifications
 *
 * Note: /unread-count and /read-all are declared before /:id to
 * prevent Express treating those path segments as IDs.
 */

const express = require('express');
const notificationController = require('../controllers/notificationController');
const { verifyJWT }          = require('../middleware/auth');
const {
  validateIdParam,
  handleValidationErrors,
  validatePagination,
} = require('../middleware/validate');

const router = express.Router();

// All notification routes require authentication
router.use(verifyJWT);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for the current user (paginated)
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  handleValidationErrors,
  notificationController.getNotifications
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification badge count
 * @access  Private
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all unread notifications as read
 * @access  Private
 */
router.put('/read-all', notificationController.markAllNotificationsRead);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.put(
  '/:id/read',
  validateIdParam('id'),
  handleValidationErrors,
  notificationController.markNotificationRead
);

module.exports = router;
