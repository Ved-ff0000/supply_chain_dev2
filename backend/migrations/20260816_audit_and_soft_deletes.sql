-- Migration: Add audit_log table and soft-delete support
-- Run: node scripts/runMigrations.js

-- ============================================
-- AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id              SERIAL PRIMARY KEY,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       INTEGER NOT NULL,
    action          VARCHAR(50) NOT NULL,
    changed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    old_value       JSONB NULL,
    new_value       JSONB NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON audit_log (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

-- ============================================
-- SOFT DELETE SUPPORT
-- ============================================

-- Shipments: add soft-delete columns
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Shipment Events: add soft-delete columns
ALTER TABLE shipment_events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shipment_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE shipment_events ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Users: add soft-delete and auth support columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;

-- Notifications: no soft-delete needed (cascade on shipment delete is fine)

-- ============================================
-- SOFT DELETE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_shipments_not_deleted ON shipments (is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shipment_events_not_deleted ON shipment_events (is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_not_deleted ON users (is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shipments_actual_delivery ON shipments (actual_delivery) WHERE actual_delivery IS NOT NULL AND is_deleted = FALSE;
