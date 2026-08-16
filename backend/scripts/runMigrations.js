/**
 * Migration runner with a persistent ledger.
 *
 * Every .sql file in ../migrations is applied exactly once, in filename order,
 * inside a transaction. Applied files are recorded in the schema_migrations
 * table so re-running this script is always safe and idempotent.
 *
 * Connection settings come from the same place the app reads them
 * (DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD). DATABASE_URL is
 * supported as an optional override and is expanded into the DB_* vars before
 * the shared pool module is loaded.
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const migrationsDir = path.resolve(__dirname, "..", "migrations");

// ------------------------------------------------------
// Optional DATABASE_URL override
// ------------------------------------------------------
//
// database.js reads DB_* variables. If the operator supplied a single
// DATABASE_URL instead, expand it here so both agree.

if (process.env.DATABASE_URL) {
    try {
        const dbUrl = new URL(process.env.DATABASE_URL);

        process.env.DB_HOST = dbUrl.hostname || process.env.DB_HOST;
        process.env.DB_PORT = dbUrl.port || process.env.DB_PORT || "5432";
        process.env.DB_NAME = dbUrl.pathname
            ? decodeURIComponent(dbUrl.pathname.replace(/^\//, ""))
            : process.env.DB_NAME;

        if (dbUrl.username) {
            process.env.DB_USER = decodeURIComponent(dbUrl.username);
        }

        if (dbUrl.password) {
            process.env.DB_PASSWORD = decodeURIComponent(dbUrl.password);
        }
    } catch (error) {
        console.warn(
            "[Migrations] DATABASE_URL could not be parsed, falling back to DB_* variables."
        );
    }
}

const pool = require("../src/config/database");

// ------------------------------------------------------
// Ledger
// ------------------------------------------------------

const ensureLedger = async (client) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename    VARCHAR(255) PRIMARY KEY,
            applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

const getAppliedMigrations = async (client) => {
    const result = await client.query(
        "SELECT filename FROM schema_migrations"
    );

    return new Set(result.rows.map((row) => row.filename));
};

// ------------------------------------------------------
// Runner
// ------------------------------------------------------

const run = async () => {
    const client = await pool.connect();

    try {
        await ensureLedger(client);

        const applied = await getAppliedMigrations(client);

        if (!fs.existsSync(migrationsDir)) {
            console.log("[Migrations] No migrations directory found.");
            return;
        }

        const files = fs
            .readdirSync(migrationsDir)
            .filter((file) => file.endsWith(".sql"))
            .sort();

        if (files.length === 0) {
            console.log("[Migrations] No migration files found.");
            return;
        }

        const pending = files.filter((file) => !applied.has(file));

        if (pending.length === 0) {
            console.log(
                `[Migrations] Database is up to date (${files.length} migration(s) already applied).`
            );
            return;
        }

        console.log(
            `[Migrations] ${pending.length} pending migration(s) of ${files.length} total.`
        );

        for (const file of pending) {
            const sql = fs.readFileSync(
                path.join(migrationsDir, file),
                "utf8"
            );

            process.stdout.write(`[Migrations] Applying ${file} ... `);

            try {
                await client.query("BEGIN");
                await client.query(sql);

                await client.query(
                    `
                    INSERT INTO schema_migrations (filename)
                    VALUES ($1)
                    ON CONFLICT (filename) DO NOTHING
                    `,
                    [file]
                );

                await client.query("COMMIT");

                console.log("done");
            } catch (error) {
                await client.query("ROLLBACK");
                console.log("FAILED");
                console.error(`\n[Migrations] ${file} failed: ${error.message}\n`);
                throw error;
            }
        }

        console.log("[Migrations] All migrations applied successfully.");
    } finally {
        client.release();
        await pool.end();
    }
};

run().catch((error) => {
    console.error("[Migrations] Migration run aborted:", error.message);
    process.exit(1);
});
