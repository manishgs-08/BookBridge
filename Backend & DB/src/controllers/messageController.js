/**
 * Message Controller
 * HTTP handlers for messaging endpoints.
 * All business logic delegated to messageService.
 */

const messageService = require('../services/messageService');
const { success } = require('../utils/responseHelper');

/**
 * Send a new message
 * @route POST /api/messages
 * @access Private
 */
const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.user_id;
    const { receiverId, content, negotiationId = null } = req.body;

    const message = await messageService.sendMessage(
      senderId,
      receiverId,
      content,
      negotiationId
    );

    return success(res, 'Message sent successfully', { message }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get all conversations for the logged-in user
 * @route GET /api/messages/conversations
 * @access Private
 */
const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const conversations = await messageService.getConversations(userId);
    return success(res, 'Conversations retrieved successfully', { conversations });
  } catch (err) {
    next(err);
  }
};

/**
 * Get message history with a specific user
 * @route GET /api/messages/conversations/:userId
 * @access Private (participant only — enforced by service)
 */
const getConversationHistory = async (req, res, next) => {
  try {
    const currentUserId = req.user.user_id;
    const otherUserId   = req.params.userId;
    const { page, limit } = req.query;

    const result = await messageService.getConversationHistory(
      currentUserId,
      otherUserId,
      page,
      limit
    );

    return success(res, 'Conversation history retrieved successfully', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Mark a message as read
 * @route PUT /api/messages/:id/read
 * @access Private (receiver only)
 */
const markMessageRead = async (req, res, next) => {
  try {
    const messageId = req.params.id;
    const userId    = req.user.user_id;

    const message = await messageService.markMessageRead(messageId, userId);
    return success(res, 'Message marked as read', { message });
  } catch (err) {
    next(err);
  }
};

/**
 * Get unread message count for the logged-in user
 * @route GET /api/messages/unread-count
 * @access Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const data   = await messageService.getUnreadCount(userId);
    return success(res, 'Unread count retrieved', data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendMessage,
  getConversations,
  getConversationHistory,
  markMessageRead,
  getUnreadCount,
};
