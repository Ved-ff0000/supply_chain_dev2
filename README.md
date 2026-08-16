# SupplyChain Notification Hub

Logistics and shipment-tracking platform: validated status transitions, automated
delay detection, real-time notifications (in-app, email, webhook), SQL-aggregated
analytics, and a full audit trail.

- **Backend** — Node.js, Express 5, PostgreSQL, JWT auth (`jsonwebtoken` + `bcryptjs`)
- **Frontend** — React 18 + Vite + Tailwind (`frontend/modern-ui`)
- **Roles** — `CUSTOMER`, `OPERATIONS`, `ADMIN`

---

## 1. Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ (developed on 22) |
| PostgreSQL | 13+ (developed on 18) |
| npm | 9+ |

---

## 2. Setup

### 2.1 Database

```bash
createdb supply_chain_db
```

### 2.2 Backend configuration

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set at minimum:

- `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`
- `JWT_SECRET` — a long random string (`openssl rand -hex 32`)

Every variable is documented inline in `.env.example`.

### 2.3 Install dependencies

```bash
cd backend && npm install
cd ../frontend/modern-ui && npm install
```

---

## 3. Migrations

Schema changes live in `backend/migrations/` and are applied by a runner that
records each file in a `schema_migrations` ledger, so **every migration runs
exactly once** and re-running is always safe.

```bash
cd backend

# First time only: create the base tables.
psql "$DATABASE_URL" -f schema.sql

# Apply all pending migrations (idempotent).
npm run migrate
```

Output on a fresh database:

```
[Migrations] 4 pending migration(s) of 4 total.
[Migrations] Applying 20260816_add_sessions_refresh_tokens.sql ... done
[Migrations] Applying 20260816_audit_and_soft_deletes.sql ... done
[Migrations] Applying 20260816_sessions_and_filters.sql ... done
[Migrations] Applying 20260817_auth_hardening_and_features.sql ... done
```

Running it again reports `Database is up to date`.

### Adding a migration

Create `backend/migrations/YYYYMMDD_description.sql`. Write idempotent SQL
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`); each file is executed
inside a transaction and rolled back on failure.

---

## 4. Seed data

```bash
cd backend
node seedDemoData.js
```

Generates a realistic dataset so every dashboard and list has content:

- 3 customers, 4 carriers, 1 user per role
- ~69 shipments spread over 90 days with a believable status mix
- coherent `shipment_events` timelines, notifications, and 2 pending approval requests

Safe to re-run — it resets only the rows it owns.

---

## 5. Run

Two processes, in separate terminals:

```bash
# Terminal 1 — API on :5000
cd backend
npm run dev        # or: npm start
```

```bash
# Terminal 2 — UI on :4173
cd frontend/modern-ui
npm run dev
```

Open **http://localhost:4173**.

The Vite dev server proxies `/api` to `http://localhost:5000`, so the browser
only ever talks to one origin. For production, `npm run build` emits `dist/` and
your reverse proxy should forward `/api` to the backend.

---

## 6. Demo logins

| Role | Email | Password | Sees |
|---|---|---|---|
| **ADMIN** | `admin@supplychain.local` | `Admin123!` | Everything: analytics, shipments, approvals, carriers, users, audit log |
| **OPERATIONS** | `ops@supplychain.local` | `Operations123!` | Analytics, shipments, approvals, carriers |
| **CUSTOMER** | `buyer@acme.example` | `Customer123!` | Only their own shipments, notifications, settings |

Navigation and actions are filtered per role to match backend authorization exactly.

---

## 7. Features

### Delay detection & ETA
A cron job (`DELAY_DETECTION_CRON`, default every 15 min) flags overdue or stalled
shipments as `DELAYED` **through the shared transition logic**, writing an event and
notification. Trigger it manually from the dashboard's Quick Actions or:

```
POST /api/jobs/delay-detection      { "dryRun": true }
GET  /api/shipments/:id/eta         predicted ETA from carrier/route history
```

### Audit trail & soft deletes
Every update and delete is recorded in `audit_log` (entity, action, actor, old/new
JSON). Deletes are soft (`is_deleted`, `deleted_at`, `deleted_by`) on shipments,
events, carriers and customers.

```
GET /api/audit-log?entity_type=SHIPMENT&action=STATUS_CHANGE&entity_id=42   (ADMIN)
```

### Real notifications
One pipeline in `notificationService` fans out to all three channels, honouring
each customer's preferences:

- **In-app** — persisted, plus a live push over SSE
- **Email** — Nodemailer (see §8)
- **Webhook** — HMAC-SHA256 signed, retried with exponential backoff, every attempt
  recorded in `webhook_delivery_log`

```
GET /api/notifications/stream?token=<access token>     Server-Sent Events
```

### Analytics
All figures come from SQL aggregation (`date_trunc`, `FILTER`, window functions)
and are role-scoped — a customer only ever sees their own numbers.

```
GET /api/dashboard/deliveries-over-time?interval=day&range=30d
GET /api/dashboard/avg-transit-time
GET /api/dashboard/on-time-rate
GET /api/dashboard/customs-hold-frequency
GET /api/dashboard/active-shipments-count
GET /api/dashboard/delays-24h
GET /api/dashboard/unread-notifications-count
GET /api/dashboard/export?dataset=deliveries|carriers|shipments&range=30d   (CSV)
```

### Auth hardening
- Short-lived access tokens (15 min) + opaque refresh tokens stored **only as
  SHA-256 hashes**
- **Refresh rotation with replay detection** — presenting a spent token revokes
  every session for that user
- Password reset and email verification by tokened email link (tokens hashed at rest)
- Rate limiting on all auth routes, counted in Postgres so limits survive restarts
- Session list and revoke (single device or all others) under **Settings**

```
POST   /api/auth/login | register | refresh | logout
POST   /api/auth/forgot-password | reset-password | verify-email
GET    /api/auth/sessions
DELETE /api/auth/sessions/:id
POST   /api/auth/sessions/revoke-all
```

### Customer self-service
A `CUSTOMER` submits a request, stored as a real shipment in the new
`PENDING_APPROVAL` state; `OPERATIONS`/`ADMIN` approve (→ `CREATED`) or reject
(→ `CANCELLED`) from the **Approvals** screen.

```
POST /api/shipments/request
GET  /api/shipments/requests/pending
POST /api/shipments/:id/approve | :id/reject
```

### Saved filters & bulk operations

```
GET|POST /api/filters              PATCH|DELETE /api/filters/:id
PATCH    /api/shipments/bulk-status   { "shipment_ids": [1,2,3], "status": "IN_TRANSIT" }
```

Bulk updates run each shipment through the same validation as a single update, so an
illegal transition is reported per-shipment instead of failing the whole batch
(HTTP `207` for a partial success).

---

## 8. Email in development

With no SMTP credentials, `EMAIL_MODE=ethereal` creates a throwaway test inbox at
boot and logs a **preview URL** for every message — password-reset and verification
links are fully clickable without a real mailbox.

If outbound SMTP is blocked, the service automatically falls back to a JSON
transport and prints the message (including the link) to the server log, so the
flows remain testable offline.

To send real mail, set `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`.

---

## 9. Architecture notes

**Single source of truth for status changes.** `backend/src/constants/statusTransitions.js`
defines the state machine; `backend/src/services/statusChangeService.js` is the one
path that applies a change — validate → update + event (in a transaction) → audit →
notify. Single updates, bulk updates, request approvals and the delay-detection job
all call into it rather than duplicating the logic.

**Design system.** The UI extends the existing dark obsidian theme in
`frontend/modern-ui/src/styles/tailwind.css`. New screens reuse the same
`glass-surface` cards, `rule` borders, `pill-badge` eyebrows, `data-table` and
button styles. A shared text hierarchy (`h1-page`, `h2-section`, `eyebrow`,
`kpi-number`, `kpi-label`, `kpi-caption`, `body-text`, `nav-item-text`) is applied
across all screens.

**No mock data.** Every figure in the UI comes from a live endpoint. Loading,
error and empty states are explicit — the app never invents a placeholder number.

```
backend/src/
  constants/    status vocabulary + transition rules
  services/     business logic (status, notification, token, audit, webhook, email…)
  controllers/  HTTP handling
  routes/       routing + role guards
  middleware/   auth, rate limiting, validation
  jobs/         cron
frontend/modern-ui/src/
  lib/          api client, auth + notification context, domain helpers
  components/   dashboard, shipments, shared primitives
  views/        auth, notifications, carriers, users, audit, settings, approvals
```

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `Database connection failed` | Check the `DB_*` values in `backend/.env` and that PostgreSQL is running. |
| `column "refresh_token" does not exist` | You are on an old checkout. Run `npm run migrate`; the sessions table is reconciled by `20260817_auth_hardening_and_features.sql`. |
| 401 immediately after signing in | `JWT_SECRET` changed since the token was issued — sign in again. |
| No emails | Expected without SMTP. Check the server log for the Ethereal preview URL or the JSON-transport payload. |
| Live notifications not arriving | The SSE stream needs a direct HTTP connection; make sure any proxy does not buffer `text/event-stream`. |
