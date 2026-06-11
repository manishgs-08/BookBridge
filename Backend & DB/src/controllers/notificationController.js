/**
 * Notification Controller
 * HTTP handlers for notification endpoints.
 */

const notificationService = require('../services/notificationService');
const { success }         = require('../utils/responseHelper');

/**
 * Get all notifications for the current user (paginated)
 * @route GET /api/notifications
 * @access Private
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { page, limit } = req.query;

    const result = await notificationService.getNotifications(userId, page, limit);
    return success(res, 'Notifications retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get unread notification count
 * @route GET /api/notifications/unread-count
 * @access Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const data   = await notificationService.getUnreadCount(userId);
    return success(res, 'Unread count retrieved', data);
  } catch (err) {
    next(err);
  }
};

/**
 * Mark a single notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId         = req.user.user_id;

    const notification = await notificationService.markNotificationRead(
      notificationId,
      userId
    );

    return success(res, 'Notification marked as read', { notification });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark all notifications as read
 * @route PUT /api/notifications/read-all
 * @access Private
 */
const markAllNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const result = await notificationService.markAllNotificationsRead(userId);
    return success(res, `${result.markedCount} notification(s) marked as read`, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
