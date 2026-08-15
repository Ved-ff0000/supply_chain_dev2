const express = require("express");

const router = express.Router();


// ======================================================
// CONTROLLER
// ======================================================

const {
    register,
    login,
    getMe
} = require("../controllers/authController");


// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

const {
    authenticateToken
} = require("../middleware/authMiddleware");


// ======================================================
// PUBLIC ROUTES
// ======================================================
//
// POST /api/auth/register
// POST /api/auth/login
//
// ======================================================

router.post(
    "/register",
    register
);

router.post(
    "/login",
    login
);


// ======================================================
// PROTECTED ROUTES
// ======================================================
//
// GET /api/auth/me
//
// Requires a valid JWT.
//
// ======================================================

router.get(
    "/me",
    authenticateToken,
    getMe
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;