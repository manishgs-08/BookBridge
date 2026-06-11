/**
 * Rate Limiting Middleware
 *
 * Three tiers:
 *  1. authLimiter     — 10 req / 15 min  (auth endpoints — brute-force protection)
 *  2. messageLimiter  — 100 req / 15 min (messaging — anti-spam)
 *  3. generalLimiter  — 500 req / 15 min (all other API routes)
 *
 * All limiters return a consistent JSON response matching the project's error format.
 * Skip limit for admins is intentionally NOT implemented — rate limits apply to everyone.
 */

'use strict';

const rateLimit = require('express-rate-limit');

// ─── Shared response handler ───────────────────────────────────────────────

/**
 * Standard "too many requests" JSON response.
 * Matches the project's { success, message } error envelope.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
  });
};

// ─── Tier 1: Auth limiter ──────────────────────────────────────────────────

/**
 * Strict limit on auth endpoints:
 *   GET  /api/auth/google
 *   GET  /api/auth/google/callback
 *   POST /api/auth/verify-seller
 *
 * 10 requests per 15 minutes per IP.
 * Prevents brute-force USN enumeration and OAuth initiation flooding.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,
  standardHeaders: true,        // Return RateLimit-* headers (RFC 6585)
  legacyHeaders: false,         // Suppress X-RateLimit-* headers
  handler: rateLimitHandler,
  message: 'Too many requests. Please try again later.',
  skipSuccessfulRequests: false, // Count all requests including successes
});

// ─── Tier 2: Message limiter ───────────────────────────────────────────────

/**
 * Moderate limit on messaging endpoints:
 *   All routes under /api/messages/*
 *
 * 100 requests per 15 minutes per IP.
 * Prevents message spam while allowing active conversations.
 */
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many requests. Please try again later.',
});

// ─── Tier 3: General API limiter ──────────────────────────────────────────

/**
 * General limit applied globally to all API routes.
 *
 * 500 requests per 15 minutes per IP.
 * Catch-all protection against API abuse.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many requests. Please try again later.',
});

module.exports = { authLimiter, messageLimiter, generalLimiter };
