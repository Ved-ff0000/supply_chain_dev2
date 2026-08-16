-- Supply Chain Notification Hub schema (inferred from app queries)

CREATE TABLE IF NOT EXISTS customers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(50),
    company_name    VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS carriers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL UNIQUE,
    code            VARCHAR(50)  NOT NULL UNIQUE,
    api_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(50) NOT NULL,
    customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shipments (
    id                  SERIAL PRIMARY KEY,
    tracking_number     VARCHAR(100) NOT NULL UNIQUE,
    carrier_id          INTEGER NOT NULL REFERENCES carriers(id) ON DELETE RESTRICT,
    customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    origin              TEXT NOT NULL,
    destination         TEXT NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    priority            VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    expected_delivery   TIMESTAMP NULL,
    actual_delivery     TIMESTAMP NULL,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMP NULL,
    deleted_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shipment_events (
    id              SERIAL PRIMARY KEY,
    shipment_id     INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    status          VARCHAR(50) NOT NULL,
    location        TEXT,
    description     TEXT,
    event_time      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP NULL,
    deleted_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id              SERIAL PRIMARY KEY,
    shipment_id     INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    channel         VARCHAR(50) NOT NULL DEFAULT 'IN_APP',
    status          VARCHAR(20) NOT NULL DEFAULT 'UNREAD',
    priority        VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at         TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id                          SERIAL PRIMARY KEY,
    customer_id                 INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    email_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    webhook_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    webhook_url                 VARCHAR(500) NULL,
    webhook_secret              VARCHAR(255) NULL,
    notify_in_transit           BOOLEAN NOT NULL DEFAULT TRUE,
    notify_customs_hold         BOOLEAN NOT NULL DEFAULT TRUE,
    notify_delayed              BOOLEAN NOT NULL DEFAULT TRUE,
    notify_out_for_delivery     BOOLEAN NOT NULL DEFAULT TRUE,
    notify_delivered            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    id              SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    webhook_url     VARCHAR(500) NOT NULL,
    payload         JSONB NOT NULL,
    attempt_number  INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(50) NOT NULL,
    response_code   INTEGER NULL,
    response_body   TEXT NULL,
    error_message   TEXT NULL,
    duration_ms     INTEGER NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_customer_id ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_id ON shipments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_id ON shipment_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Feature 1: Automated Delay Detection & ETA Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_delay_check ON shipments (status, expected_delivery) WHERE status NOT IN ('DELIVERED', 'CANCELLED', 'LOST', 'RETURNED', 'DELAYED');
CREATE INDEX IF NOT EXISTS idx_shipment_events_status_time ON shipment_events (shipment_id, status, event_time);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_route_status ON shipments (carrier_id, origin, destination, priority, status);

-- Feature 2: Audit Trail & Soft Delete Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON audit_log (changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_not_deleted ON shipments (is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shipment_events_not_deleted ON shipment_events (is_deleted) WHERE is_deleted = FALSE;

-- Feature 3: Webhook Delivery Log Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_log_customer ON webhook_delivery_log (customer_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_notification ON webhook_delivery_log (notification_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_created_at ON webhook_delivery_log (created_at DESC);

-- Feature 4: Analytical Performance Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_actual_delivery ON shipments (actual_delivery) WHERE actual_delivery IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_shipments_ontime_eval ON shipments (carrier_id, status, expected_delivery, actual_delivery) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_events_customs_analysis ON shipment_events (status, shipment_id, event_time) WHERE is_deleted = FALSE;

INSERT INTO customers (name, email, phone, company_name)
VALUES ('Acme Logistics Buyer', 'buyer@acme.example', '+1-555-0100', 'Acme Corp')
ON CONFLICT (email) DO NOTHING;

INSERT INTO carriers (name, code, api_enabled)
VALUES
    ('DHL Express', 'DHL', FALSE),
    ('FedEx', 'FEDEX', FALSE),
    ('UPS', 'UPS', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO notification_preferences (customer_id)
SELECT id FROM customers WHERE email = 'buyer@acme.example'
ON CONFLICT (customer_id) DO NOTHING;
