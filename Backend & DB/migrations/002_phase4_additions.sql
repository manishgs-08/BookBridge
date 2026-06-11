-- ============================================================
-- BookBridge Migration 002 — Phase 4 Additions
-- Adds RequestResponse table for Book Request Board responses
-- ============================================================

-- (USE bookbridge removed for managed DB compatibility)

-- ============================================================
-- 12. RequestResponse (NEW)
-- Sellers respond to BookRequest entries they can fulfil.
-- A seller can respond to the same request only once.
-- ============================================================
CREATE TABLE IF NOT EXISTS RequestResponse (
    response_id   INT AUTO_INCREMENT PRIMARY KEY,
    request_id    INT NOT NULL,
    seller_id     INT NOT NULL,
    message       TEXT NOT NULL,
    book_id       INT,                -- Optional: seller can link a specific listing
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (request_id) REFERENCES BookRequest(request_id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id)  REFERENCES User(user_id)           ON DELETE CASCADE,
    FOREIGN KEY (book_id)    REFERENCES Book(book_id)           ON DELETE SET NULL,
    UNIQUE KEY uk_seller_request (seller_id, request_id),
    INDEX idx_request (request_id),
    INDEX idx_seller  (seller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
