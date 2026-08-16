# SupplyChain Notification Hub — Build Plan

_Grounded in a live audit: PostgreSQL 18.4 running in-sandbox, backend booted on :5000,
React UI booted on :4173, every endpoint probed with a real admin JWT._

---

## 1. What actually exists today (verified, not assumed)

### Backend — working
| Area | Status |
|---|---|
| Express 5 app, JWT auth, `authenticateToken` + `authorizeRoles` | Working |
| `POST /api/auth/register`, `/login`, `GET /me` | Working (200) |
| Shipments CRUD, tracking lookup, status update | Working |
| `GET /api/shipments/:id/eta` (Feature 1 partial) | Working (200) |
| Status transition state machine (`statusTransitions.js`) | Working, single source of truth |
| Delay detection service + node-cron job + `POST /api/jobs/delay-detection` | Working |
| Audit service + `GET /api/audit-log` (ADMIN) | Working (200) |
| Soft deletes on shipments/events (`is_deleted`) | Columns exist, delete converted |
| Email (Nodemailer), webhook w/ retry+backoff+`webhook_delivery_log` | Services exist |
| Analytics: `/summary`, `/deliveries-over-time`, `/avg-transit-time`, `/on-time-rate`, `/customs-hold-frequency` | Working (200) |
| Carriers CRUD, Users + role mgmt (ADMIN), Notifications, Preferences | Working |

### Backend — confirmed missing (all probed, all 404/500)
```
404  GET   /api/dashboard/active-shipments-count      404  POST  /api/auth/forgot-password
404  GET   /api/dashboard/delays-24h                  404  POST  /api/auth/reset-password
404  GET   /api/dashboard/unread-notifications-count  404  POST  /api/auth/refresh
404  GET   /api/dashboard/export          (CSV)       404  POST  /api/auth/verify-email
404  GET   /api/filters                   (saved)     404  GET   /api/auth/sessions
404  POST  /api/shipments/request  (customer)         500  GET   /api/notifications/sse
500  PATCH /api/shipments/bulk-status                 —    rate limiting: absent
```

### Three real bugs found while auditing
1. **Migration conflict — blocks a clean install.** `20260816_add_sessions_refresh_tokens.sql`
   and `20260816_sessions_and_filters.sql` both create `sessions` with *different* columns.
   The second fails on a fresh DB: `column "refresh_token" does not exist`. Saved filters
   and password-reset tables therefore never get created.
2. **`GET /api/notifications/unread-count` returns 400** for ADMIN/OPERATIONS
   (`"Customer ID is required"`) — it assumes every user is a customer. This is the exact
   endpoint the "Unread Notifications" KPI card needs.
3. **No migration ledger.** `runMigrations.js` re-runs every file every time and needs
   `DATABASE_URL` while `database.js` reads `DB_*` — the two disagree.

### Frontend — two competing apps
- **`frontend/modern-ui/`** (React + Vite + Tailwind) — **this is the design system in the brief**:
  dark obsidian theme, sidebar Analytics/Shipments, 4 KPI cards, Deliveries Over Time area chart,
  Carrier On-Time Rate list, Quick Actions → "Run Delay Detector". Already proxies `/api` → :5000.
- **`frontend/`** (vanilla JS + 4 CSS files) — older parallel app, different palette
  (`#080c14`/blue), and its `api.js` hard-codes a fake token plus a full **mock fallback
  database** that silently serves fake rows whenever the API errors.

**Mock data still live in the React UI** (must all go): hardcoded KPI fallbacks `128 / 91.3% / 6 / 3`,
fake carrier rows `DHL 93.9% / FedEx 90.6% / UPS 87.8%`, three fake shipment rows, a chart
fallback series `[14,21,18,25,29,34]`, plus **auto-login with hardcoded admin credentials**
and two synthetic chart bands ("risk"/"notifications") derived arithmetically from the real series.

---

## 2. Proposed schema changes (needs your approval)

One consolidated, idempotent migration set with a `schema_migrations` ledger so each file runs once.

| Table | Purpose | Feature |
|---|---|---|
| `sessions` **(reconciled)** | `user_id, refresh_token_hash, user_agent, ip_address, expires_at, revoked, revoked_at, last_active_at` — merges the two conflicting versions into one | 5 |
| `password_reset_tokens` | `user_id, token_hash, expires_at, used_at` | 5 |
| `saved_shipment_filters` | `user_id, name, filter_json, is_default` | 7 |
| `audit_log` | already exists — add index on `action` | 2 |
| `webhook_delivery_log` | already exists — no change | 3 |
| `users` +cols | `email_verified`, `email_verification_token_hash`, `email_verification_expires` | 5 |
| `shipments` +cols | `requested_by`, `approved_by`, `approved_at` for `PENDING_APPROVAL` | 6 |
| `carriers`/`customers` +cols | `is_deleted, deleted_at, deleted_by` (soft delete parity) | 2 |
| `auth_rate_limit` | `identifier, endpoint, attempts, window_start` (DB-backed, survives restart) | 5 |

**`PENDING_APPROVAL` is a new status** added to `shipmentConstants.js` +
`statusTransitions.js` (`PENDING_APPROVAL → CREATED | CANCELLED`), so customer requests
flow through the *existing* state machine rather than around it.

---

## 3. Build order

**Backend (1→9)** — each new endpoint reuses `shipmentService` / `notificationService` /
`statusTransitions` / `auditService`; no duplicated logic.
1. Migration ledger + consolidated migrations + fix the 3 bugs above
2. Delay detection wiring & ETA (mostly done — verify + audit-log it)
3. Audit trail completion + soft-delete parity
4. Real notifications: SSE stream, email, webhook retry
5. Analytics: 3 missing KPI endpoints + CSV export, all SQL-aggregated
6. Auth hardening: refresh rotation, reset, verification, rate limit, sessions
7. Customer self-service request + approval
8. Saved filters CRUD
9. Bulk status update

**Frontend** — extend `frontend/modern-ui/` only, reusing its existing components
(`glass-surface` cards, `pill-badge` eyebrows, `table-compact`, `rule` borders, `clickable`
buttons, `AreaChart`, nav marker). Screen by screen: Auth → Analytics → Shipments →
Notifications → Carriers/Users/Audit. Plus the **formal text hierarchy** applied as shared
type tokens (`.h1-page`, `.h2-section`, `.eyebrow`, `.kpi-number`, `.kpi-label`, `.kpi-caption`,
`.body-text`, `.nav-item`) so old and new screens match exactly. All mock data deleted.

---

## 4. Open questions → see chat
