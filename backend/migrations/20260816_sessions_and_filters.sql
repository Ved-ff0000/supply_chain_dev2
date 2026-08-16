-- Migration: Password reset tokens and saved shipment filters
--
-- NOTE: This file previously also created a `sessions` table whose columns
-- conflicted with the `sessions` table created by
-- 20260816_add_sessions_refresh_tokens.sql (refresh_token vs refresh_token_hash),
-- which made a clean install fail with:
--     column "refresh_token" does not exist
--
-- Session table ownership now lives in a single place:
-- 20260817_auth_hardening_and_features.sql reconciles it. This file only
-- creates the tables it uniquely owns.

-- ============================================
-- PASSWORD RESET TOKENS
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
