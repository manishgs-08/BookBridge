/**
 * Message Routes
 * Base path: /api/messages
 *
 * IMPORTANT: specific sub-paths (/conversations, /unread-count) are declared
 * BEFORE the generic /:id path to prevent Express from matching them as IDs.
 */

const express = require('express');
const messageController = require('../controllers/messageController');
const { verifyJWT }     = require('../middleware/auth');
const {
  validateIdParam,
  handleValidationErrors,
  validateSendMessage,
} = require('../middleware/validate');
const { messageLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All messaging routes require authentication and message rate limits
router.use(messageLimiter);
router.use(verifyJWT);

/**
 * @route   GET /api/messages/conversations
 * @desc    List all conversation threads for the current user
 * @access  Private
 */
router.get('/conversations', messageController.getConversations);

/**
 * @route   GET /api/messages/unread-count
 * @desc    Get total unread message count for the current user
 * @access  Private
 */
router.get('/unread-count', messageController.getUnreadCount);

/**
 * @route   GET /api/messages/conversations/:userId
 * @desc    Get full message history with a specific user (paginated)
 * @access  Private
 */
router.get(
  '/conversations/:userId',
  validateIdParam('userId'),
  handleValidationErrors,
  messageController.getConversationHistory
);

/**
 * @route   POST /api/messages
 * @desc    Send a new message
 * @body    { receiverId: number, content: string, negotiationId?: number }
 * @access  Private
 */
router.post(
  '/',
  validateSendMessage,
  handleValidationErrors,
  messageController.sendMessage
);

/**
 * @route   PUT /api/messages/:id/read
 * @desc    Mark a specific message as read (receiver only)
 * @access  Private
 */
router.put(
  '/:id/read',
  validateIdParam('id'),
  handleValidationErrors,
  messageController.markMessageRead
);

module.exports = router;
