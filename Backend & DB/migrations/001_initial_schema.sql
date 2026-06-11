-- ============================================================
-- BookBridge Database Schema
-- Full schema based on ER diagram + approved modifications
-- ============================================================

-- Run this script against your MySQL database:
--   mysql -u root -p bookbridge < migrations/001_initial_schema.sql

-- ============================================================
-- 1. User
-- Base entity from ER diagram + Google OAuth fields + RBAC
-- Removed: password (Google OAuth only)
-- Added: google_id, email_verified, profile_picture, role,
--         seller_verified, usn
-- ============================================================
CREATE TABLE IF NOT EXISTS User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    profile_picture VARCHAR(500),
    role ENUM('buyer', 'seller', 'admin') DEFAULT 'buyer',
    seller_verified BOOLEAN DEFAULT FALSE,
    usn VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_google_id (google_id),
    UNIQUE KEY uk_email (email),
    INDEX idx_role (role),
    INDEX idx_seller_verified (seller_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Book
-- Base entity from ER diagram + metadata for search & pricing
-- Added: description, isbn, category, semester, branch,
--         original_price, image_url, updated_at
-- ============================================================
CREATE TABLE IF NOT EXISTS Book (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT,
    isbn VARCHAR(20),
    category VARCHAR(100),
    semester INT,
    branch VARCHAR(50),
    `condition` ENUM('Like New', 'Very Good', 'Good', 'Fair', 'Poor') NOT NULL,
    original_price DECIMAL(10, 2),
    asking_price DECIMAL(10, 2) NOT NULL,
    status ENUM('available', 'reserved', 'sold', 'removed') DEFAULT 'available',
    published_year INT,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (seller_id) REFERENCES User(user_id) ON DELETE CASCADE,
    INDEX idx_seller (seller_id),
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_branch_semester (branch, semester),
    INDEX idx_condition (`condition`),
    FULLTEXT INDEX idx_search (title, author, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Wishlist
-- Base entity from ER diagram
-- Fixed: created_id → created_at, added book_id FK
-- ============================================================
CREATE TABLE IF NOT EXISTS Wishlist (
    wishlist_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES Book(book_id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_book (user_id, book_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. Negotiation
-- Base entity from ER diagram
-- Added: buyer_id FK (implied by "buyer_in" relationship)
-- ============================================================
CREATE TABLE IF NOT EXISTS Negotiation (
    negotiation_id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    buyer_id INT NOT NULL,
    status ENUM('active', 'accepted', 'rejected', 'cancelled', 'expired') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (book_id) REFERENCES Book(book_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES User(user_id) ON DELETE CASCADE,
    INDEX idx_book (book_id),
    INDEX idx_buyer (buyer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. Offers
-- Base entity from ER diagram (append-only history log)
-- Each offer/counteroffer creates a new row — never overwritten
-- ============================================================
CREATE TABLE IF NOT EXISTS Offers (
    offer_id INT AUTO_INCREMENT PRIMARY KEY,
    negotiation_id INT NOT NULL,
    user_id INT NOT NULL,
    offered_price DECIMAL(10, 2) NOT NULL,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (negotiation_id) REFERENCES Negotiation(negotiation_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    INDEX idx_negotiation (negotiation_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. Transaction
-- Base entity from ER diagram
-- Added: negotiation_id FK (implied by "result_in" relationship)
-- Note: agreement record only — no payment processing in v1
-- ============================================================
CREATE TABLE IF NOT EXISTS Transaction (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    negotiation_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_negotiation (negotiation_id),
    FOREIGN KEY (negotiation_id) REFERENCES Negotiation(negotiation_id) ON DELETE CASCADE,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. Dispute
-- Base entity from ER diagram (no changes needed)
-- ============================================================
CREATE TABLE IF NOT EXISTS Dispute (
    dispute_id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    raised_by INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('open', 'under_review', 'resolved', 'dismissed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,

    FOREIGN KEY (transaction_id) REFERENCES Transaction(transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (raised_by) REFERENCES User(user_id) ON DELETE CASCADE,
    INDEX idx_transaction (transaction_id),
    INDEX idx_raised_by (raised_by),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. Message (NEW — approved)
-- REST-based persistent messaging
-- negotiation_id is nullable: messages can exist outside negotiations
-- ============================================================
CREATE TABLE IF NOT EXISTS Message (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    negotiation_id INT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (sender_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (negotiation_id) REFERENCES Negotiation(negotiation_id) ON DELETE SET NULL,
    INDEX idx_sender (sender_id),
    INDEX idx_receiver (receiver_id),
    INDEX idx_conversation (sender_id, receiver_id, created_at),
    INDEX idx_receiver_unread (receiver_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. Review (NEW — approved)
-- Post-transaction ratings & reviews
-- One review per reviewer per transaction (unique constraint)
-- ============================================================
CREATE TABLE IF NOT EXISTS Review (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    reviewer_id INT NOT NULL,
    reviewed_user_id INT NOT NULL,
    transaction_id INT NOT NULL,
    rating TINYINT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reviewer_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES Transaction(transaction_id) ON DELETE CASCADE,
    UNIQUE KEY uk_reviewer_transaction (reviewer_id, transaction_id),
    INDEX idx_reviewed_user (reviewed_user_id),
    CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. Notification (NEW — approved)
-- In-app notifications only (no email/push in v1)
-- reference_id + reference_type for polymorphic linking
-- ============================================================
CREATE TABLE IF NOT EXISTS Notification (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('offer', 'counteroffer', 'message', 'transaction', 'dispute', 'review', 'system') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    reference_id INT,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. BookRequest (NEW — approved)
-- Book request board: students can request books they need
-- ============================================================
CREATE TABLE IF NOT EXISTS BookRequest (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    isbn VARCHAR(20),
    category VARCHAR(100),
    semester INT,
    branch VARCHAR(50),
    max_budget DECIMAL(10, 2),
    description TEXT,
    status ENUM('open', 'fulfilled', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
