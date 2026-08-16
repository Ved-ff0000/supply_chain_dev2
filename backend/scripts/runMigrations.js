require('dotenv').config();
const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '..', 'migrations');

if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL in environment. Copy .env.example to .env and set DATABASE_URL.');
    process.exit(1);
}

// If DATABASE_URL is provided, parse it into DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD
try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    process.env.DB_HOST = dbUrl.hostname;
    process.env.DB_PORT = dbUrl.port || '5432';
    process.env.DB_NAME = dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : '';
    process.env.DB_USER = dbUrl.username;
    process.env.DB_PASSWORD = dbUrl.password;
} catch (e) {
    console.warn('Failed to parse DATABASE_URL, ensure DB_* env vars are set.');
}

const pool = require('../src/config/database');

async function run() {
    try {
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            console.log('No migration files found in', migrationsDir);
            process.exit(0);
        }

        console.log(`Found ${files.length} migration(s). Running in order...`);

        for (const file of files) {
            const fullPath = path.join(migrationsDir, file);
            console.log(`
--- Applying: ${file} ---`);
            const sql = fs.readFileSync(fullPath, 'utf8');

            // Simple split by semicolon may fail for complex files; execute whole file as one query
            try {
                await pool.query(sql);
                console.log(`Applied: ${file}`);
            } catch (err) {
                console.error(`Failed to apply migration ${file}:`, err.message || err);
                throw err;
            }
        }

        console.log('\nAll migrations applied successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration runner failed:', err.message || err);
        process.exit(1);
    } finally {
        try { await pool.end(); } catch (e) { /* ignore */ }
    }
}

run();
