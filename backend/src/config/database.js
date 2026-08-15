const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// Successful connection
pool.on("connect", () => {
    console.log("✅ PostgreSQL database connected");
});

// Database error
pool.on("error", (error) => {
    console.error("❌ PostgreSQL error:", error.message);
});

module.exports = pool;