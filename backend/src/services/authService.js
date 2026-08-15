const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ========================================
// REGISTER USER
// ========================================

const registerUser = async ({
    name,
    email,
    password,
    role = "CUSTOMER",
    customer_id = null
}) => {

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.trim().toUpperCase();

    // Check existing user
    const existingUser = await pool.query(
        `
        SELECT id
        FROM users
        WHERE email = $1
        `,
        [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
        throw new Error("Email already registered");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
        `
        INSERT INTO users (
            name,
            email,
            password_hash,
            role,
            customer_id,
            is_active
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            TRUE
        )
        RETURNING
            id,
            name,
            email,
            role,
            customer_id,
            is_active,
            created_at
        `,
        [
            name.trim(),
            normalizedEmail,
            passwordHash,
            normalizedRole,
            customer_id || null
        ]
    );

    return result.rows[0];
};


// ========================================
// LOGIN USER
// ========================================

const loginUser = async (email, password) => {

    const normalizedEmail =
        email.trim().toLowerCase();

    const result = await pool.query(
        `
        SELECT
            id,
            name,
            email,
            password_hash,
            role,
            customer_id,
            is_active
        FROM users
        WHERE email = $1
        `,
        [normalizedEmail]
    );

    if (result.rows.length === 0) {
        throw new Error("Invalid email or password");
    }

    const user = result.rows[0];

    if (!user.is_active) {
        throw new Error("User account is inactive");
    }

    const passwordValid =
        await bcrypt.compare(
            password,
            user.password_hash
        );

    if (!passwordValid) {
        throw new Error("Invalid email or password");
    }

    // Create JWT
    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            customer_id: user.customer_id
        },
        process.env.JWT_SECRET,
        {
            expiresIn:
                process.env.JWT_EXPIRES_IN || "1d"
        }
    );

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            customer_id: user.customer_id,
            is_active: user.is_active
        }
    };
};


// ========================================
// GET USER BY ID
// ========================================

const getUserById = async (userId) => {

    const result = await pool.query(
        `
        SELECT
            id,
            name,
            email,
            role,
            customer_id,
            is_active,
            created_at,
            updated_at
        FROM users
        WHERE id = $1
        `,
        [userId]
    );

    return result.rows[0];
};


// ========================================
// EXPORT
// ========================================

module.exports = {
    registerUser,
    loginUser,
    getUserById
};