# Backend — SupplyChain Notification Hub

Setup

1. Copy environment example:

```bash
cp .env.example .env
# Fill DB url, JWT secrets, email creds
```

2. Install dependencies

```bash
cd backend
npm install
```

3. Create database and run schema (or use migrations):

```bash
# Run schema.sql once to initialize
psql $DATABASE_URL -f schema.sql

# Run new SQL migrations from ./migrations in order
for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
```

4. Seed demo users (if needed):

```bash
node seedUsers.js
```

5. Start server

```bash
npm start
```

New features added in this branch

- Jobs endpoint: `POST /api/jobs/delay-detection` (OPERATIONS/ADMIN) — triggers automated delay detection.
- Migrations: `migrations/20260816_add_sessions_refresh_tokens.sql` to add `sessions` and `refresh_tokens` tables.

Notes

- Audit logging, webhook delivery log, and soft-delete fields already present in `schema.sql`.
- ETA prediction and delay detection services exist under `src/services` and `src/jobs`.
- Use environment variables from `.env.example` for SMTP and JWT configuration.
