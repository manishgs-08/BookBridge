-- ============================================================
-- BookBridge Migration 004 — Add request_response notification
-- ============================================================

-- (USE bookbridge removed for managed DB compatibility)

-- Update the ENUM for Notification type to include 'request_response'
ALTER TABLE Notification 
MODIFY COLUMN type ENUM('offer', 'counteroffer', 'message', 'transaction', 'dispute', 'review', 'system', 'request_response') NOT NULL;
