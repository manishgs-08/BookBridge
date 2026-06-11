-- ============================================================
-- BookBridge Migration 003 — Production Hardening
-- Adds AuthCode table for secure OAuth token exchange
-- ============================================================

-- (USE bookbridge removed for managed DB compatibility)

-- ============================================================
-- 13. AuthCode — One-time OAuth exchange codes
--
-- After Google OAuth callback, instead of embedding the JWT in
-- the redirect URL, we store a short-lived random code here and
-- redirect the frontend to /auth/callback?code=<code>.
-- The frontend calls POST /api/auth/exchange with the code to
-- receive the JWT in the response body (never in a URL).
--
-- Design:
-- - code is a 64-char URL-safe random hex string
-- - expires_at is 60 seconds after creation
-- - used BOOLEAN ensures single-use (cannot be exchanged twice)
-- ============================================================
CREATE TABLE IF NOT EXISTS AuthCode (
    code_id    INT AUTO_INCREMENT PRIMARY KEY,
    code       VARCHAR(128) NOT NULL,
    user_id    INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_code (code),
    INDEX idx_user_id (user_id),
    INDEX idx_expires (expires_at),

    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
