/**
 * Application-wide constants
 * Centralized enums, regex patterns, and configuration values
 */

const ROLES = Object.freeze({
  BUYER: 'buyer',
  SELLER: 'seller',
  ADMIN: 'admin',
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

const SJEC_DOMAIN = process.env.SJEC_DOMAIN || 'sjec.ac.in';

// VTU USN format for SJEC: 4SOYYBRXXX
// 4SO = SJEC college code
// YY  = admission year (2 digits)
// BR  = branch code (2 uppercase letters)
// XXX = serial number (3 digits)
const USN_REGEX = /^4SO\d{2}[A-Z]{2}\d{3}$/;

const BOOK_CONDITIONS = Object.freeze([
  'Like New',
  'Very Good',
  'Good',
  'Fair',
  'Poor',
]);

const BOOK_STATUS = Object.freeze({
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  SOLD: 'sold',
  REMOVED: 'removed',
});

const NEGOTIATION_STATUS = Object.freeze({
  ACTIVE: 'active',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
});

const TRANSACTION_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const DISPUTE_STATUS = Object.freeze({
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
});

const NOTIFICATION_TYPES = Object.freeze([
  'offer',
  'counteroffer',
  'message',
  'transaction',
  'dispute',
  'review',
  'system',
  'request_response',
]);

const REQUEST_STATUS = Object.freeze({
  OPEN: 'open',
  FULFILLED: 'fulfilled',
  CLOSED: 'closed',
});

// Rule-based price recommendation multipliers
const PRICE_MULTIPLIERS = Object.freeze({
  'Like New': 0.8,
  'Very Good': 0.7,
  'Good': 0.6,
  'Fair': 0.4,
  'Poor': 0.2,
});

// Pagination defaults
const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

module.exports = {
  ROLES,
  ALL_ROLES,
  SJEC_DOMAIN,
  USN_REGEX,
  BOOK_CONDITIONS,
  BOOK_STATUS,
  NEGOTIATION_STATUS,
  TRANSACTION_STATUS,
  DISPUTE_STATUS,
  NOTIFICATION_TYPES,
  REQUEST_STATUS,
  PRICE_MULTIPLIERS,
  PAGINATION,
};
