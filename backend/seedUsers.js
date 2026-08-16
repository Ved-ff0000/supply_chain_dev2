const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const pool = require("./src/config/database");

async function seed() {
    const adminHash = await bcrypt.hash("Admin123!", 12);
    const customerHash = await bcrypt.hash("Customer123!", 12);

    await pool.query(
        `
        INSERT INTO users (name, email, password_hash, role, customer_id, is_active)
        VALUES ('System Admin', 'admin@supplychain.local', $1, 'ADMIN', NULL, TRUE)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role = 'ADMIN',
            is_active = TRUE
        `,
        [adminHash]
    );

    await pool.query(
        `
        INSERT INTO users (name, email, password_hash, role, customer_id, is_active)
        VALUES ('Acme Buyer', 'buyer@acme.example', $1, 'CUSTOMER', 1, TRUE)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role = 'CUSTOMER',
            customer_id = 1,
            is_active = TRUE
        `,
        [customerHash]
    );

    console.log("Seeded:");
    console.log("  admin@supplychain.local / Admin123!");
    console.log("  buyer@acme.example / Customer123!");
    await pool.end();
}

seed().catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
});
