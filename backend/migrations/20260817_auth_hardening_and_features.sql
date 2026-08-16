-- Migration: Auth hardening, customer self-service requests, soft-delete parity
--
-- Consolidates the previously conflicting `sessions` definitions and adds the
-- schema required by:
--   Feature 2 — soft-delete parity for carriers/customers
--   Feature 5 — refresh rotation, email verification, rate limiting, sessions
--   Feature 6 — customer shipment requests (PENDING_APPROVAL)

-- ============================================
-- SESSIONS (reconciled)
-- ============================================
--
-- Two earlier migrations each created `sessions` with different columns.
-- This block converges any existing shape onto the canonical one and is safe
-- whether the table is absent, in the "refresh_token" shape, or already correct.

CREATE TABLE IF NOT EXISTS sessions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  TEXT NULL,
    user_agent          VARCHAR(500) NULL,
    device_info         TEXT NULL,
    ip_address          VARCHAR(64) NULL,
    expires_at          TIMESTAMP NULL,
    last_active_at      TIMESTAMP NULL,
    revoked             BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at          TIMESTAMP NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent         VARCHAR(500) NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_info        TEXT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address         VARCHAR(64) NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at         TIMESTAMP NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at     TIMESTAMP NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at         TIMESTAMP NULL;

-- Carry over data from the legacy plaintext column, then retire it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'refresh_token'
    ) THEN
        UPDATE sessions
        SET refresh_token_hash = COALESCE(refresh_token_hash, refresh_token)
        WHERE refresh_token_hash IS NULL;

        ALTER TABLE sessions DROP COLUMN refresh_token;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- ============================================
-- PASSWORD RESET TOKENS (hashed at rest)
-- ============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMP NOT NULL,
    used_at         TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens (token);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id);

-- ============================================
-- SAVED SHIPMENT FILTERS
-- ============================================

CREATE TABLE IF NOT EXISTS saved_shipment_filters (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    filter_json     JSONB NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_shipment_filters (user_id);

-- ============================================
-- EMAIL VERIFICATION (Feature 5)
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_verification
    ON users (email_verification_token);

-- Existing accounts predate verification; treat them as verified so the
-- upgrade does not lock anyone out.
UPDATE users
SET email_verified = TRUE
WHERE email_verified = FALSE
  AND created_at < CURRENT_TIMESTAMP;

-- ============================================
-- AUTH RATE LIMITING (Feature 5)
-- ============================================
--
-- DB-backed so limits survive a process restart and work across instances.

CREATE TABLE IF NOT EXISTS auth_rate_limit (
    id              SERIAL PRIMARY KEY,
    identifier      VARCHAR(255) NOT NULL,
    endpoint        VARCHAR(100) NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 1,
    window_start    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (identifier, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_window
    ON auth_rate_limit (window_start);

-- ============================================
-- CUSTOMER SHIPMENT REQUESTS (Feature 6)
-- ============================================

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS requested_by INTEGER
    REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS approved_by INTEGER
    REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_pending_approval
    ON shipments (status) WHERE status = 'PENDING_APPROVAL';

-- ============================================
-- SOFT DELETE PARITY (Feature 2)
-- ============================================

ALTER TABLE carriers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS deleted_by INTEGER
    REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_by INTEGER
    REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_carriers_not_deleted
    ON carriers (is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_customers_not_deleted
    ON customers (is_deleted) WHERE is_deleted = FALSE;

-- ============================================
-- AUDIT LOG INDEX (Feature 2)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);

-- ============================================
-- NOTIFICATION READ-STATE INDEX (Feature 4)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (customer_id, status) WHERE status = 'UNREAD';
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON notifications (created_at DESC);
