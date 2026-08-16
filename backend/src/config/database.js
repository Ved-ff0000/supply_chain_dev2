const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({
    path: path.join(__dirname, "../../.env")
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.on("connect", () => {
    console.log("PostgreSQL database connected");
});

pool.on("error", (error) => {
    console.error("PostgreSQL error:", error.message);
});

module.exports = pool;