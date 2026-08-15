const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../config/database");


// ======================================================
// GENERATE JWT
// ======================================================

const generateToken = (user) => {

    return jwt.sign(
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

};


// ======================================================
// REGISTER
// ======================================================
//
// POST /api/auth/register
//
// Body:
//
// {
//     "name": "Rahul Sharma",
//     "email": "rahul@example.com",
//     "password": "password123",
//     "role": "CUSTOMER",
//     "customer_id": 1
// }
//
// ======================================================

const register = async (req, res) => {

    try {

        const {
            name,
            email,
            password,
            role,
            customer_id
        } = req.body;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (
            !name ||
            !email ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Name, email and password are required"

            });

        }


        if (password.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "Password must be at least 6 characters long"

            });

        }


        // ==================================================
        // NORMALIZE DATA
        // ==================================================

        const normalizedEmail =
            email.trim().toLowerCase();

        const normalizedRole =
            (role || "CUSTOMER")
                .trim()
                .toUpperCase();


        // ==================================================
        // VALIDATE ROLE
        // ==================================================

        const allowedRoles = [
            "CUSTOMER",
            "ADMIN",
            "OPERATIONS"
        ];


        if (
            !allowedRoles.includes(
                normalizedRole
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid role"

            });

        }


        // ==================================================
        // CUSTOMER VALIDATION
        // ==================================================

        if (
            normalizedRole === "CUSTOMER" &&
            !customer_id
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "customer_id is required for CUSTOMER users"

            });

        }


        // ==================================================
        // CHECK EXISTING USER
        // ==================================================

        const existingUser =
            await pool.query(
                `
                SELECT
                    id
                FROM users
                WHERE email = $1
                `,
                [normalizedEmail]
            );


        if (
            existingUser.rows.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "User with this email already exists"

            });

        }


        // ==================================================
        // CHECK CUSTOMER
        // ==================================================

        if (
            normalizedRole === "CUSTOMER"
        ) {

            const customerResult =
                await pool.query(
                    `
                    SELECT
                        id
                    FROM customers
                    WHERE id = $1
                    `,
                    [customer_id]
                );


            if (
                customerResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Customer not found"

                });

            }

        }


        // ==================================================
        // HASH PASSWORD
        // ==================================================

        const passwordHash =
            await bcrypt.hash(
                password,
                12
            );


        // ==================================================
        // CREATE USER
        // ==================================================

        const result =
            await pool.query(
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


        const user =
            result.rows[0];


        // ==================================================
        // GENERATE TOKEN
        // ==================================================

        const token =
            generateToken(user);


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            message:
                "User registered successfully",

            token,

            user

        });

    } catch (error) {

        console.error(
            "Registration error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to register user",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

};


// ======================================================
// LOGIN
// ======================================================
//
// POST /api/auth/login
//
// Body:
//
// {
//     "email": "rahul@example.com",
//     "password": "password123"
// }
//
// ======================================================

const login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (
            !email ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required"

            });

        }


        const normalizedEmail =
            email.trim().toLowerCase();


        // ==================================================
        // FIND USER
        // ==================================================

        const result =
            await pool.query(
                `
                SELECT

                    id,
                    name,
                    email,
                    password_hash,
                    role,
                    customer_id,
                    is_active,
                    created_at

                FROM users

                WHERE email = $1
                `,
                [normalizedEmail]
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        const user =
            result.rows[0];


        // ==================================================
        // CHECK ACTIVE STATUS
        // ==================================================

        if (
            user.is_active === false
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "User account is inactive"

            });

        }


        // ==================================================
        // VERIFY PASSWORD
        // ==================================================

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        if (!passwordMatch) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password"

            });

        }


        // ==================================================
        // GENERATE JWT
        // ==================================================

        const token =
            generateToken(user);


        // ==================================================
        // REMOVE PASSWORD HASH
        // ==================================================

        delete user.password_hash;


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                "Login successful",

            token,

            user

        });

    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to login",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

};


// ======================================================
// GET CURRENT USER
// ======================================================
//
// GET /api/auth/me
//
// Requires:
//
// Authorization: Bearer <token>
//
// ======================================================

const getMe = async (req, res) => {

    try {

        // ==================================================
        // req.user COMES FROM authMiddleware
        // ==================================================

        const userId =
            req.user.id;


        const result =
            await pool.query(
                `
                SELECT

                    u.id,

                    u.name,

                    u.email,

                    u.role,

                    u.customer_id,

                    u.is_active,

                    u.created_at,

                    u.updated_at,

                    c.name AS customer_name,

                    c.company_name AS company_name

                FROM users u

                LEFT JOIN customers c
                    ON u.customer_id = c.id

                WHERE u.id = $1
                `,
                [userId]
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"

            });

        }


        return res.status(200).json({

            success: true,

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error fetching current user:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch current user",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    register,

    login,

    getMe

};