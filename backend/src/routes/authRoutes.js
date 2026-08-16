const express = require("express");

const router = express.Router();


// ======================================================
// CONTROLLER
// ======================================================

const {
    register,
    login,
    getMe,
    refresh,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    getSessions,
    deleteSession,
    deleteAllSessions
} = require("../controllers/authController");


// ======================================================
// MIDDLEWARE
// ======================================================

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const {
    rateLimit
} = require("../middleware/rateLimiter");


// ======================================================
// RATE LIMITS
// ======================================================
//
// Credential-guessing surfaces get tight limits; token refresh is called
// routinely by every signed-in tab so it gets a much larger allowance.
//
// ======================================================

const loginLimiter = rateLimit({
    endpoint: "login",
    max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 10)
});

const registerLimiter = rateLimit({
    endpoint: "register",
    max: Number(process.env.RATE_LIMIT_REGISTER_MAX || 5)
});

const forgotPasswordLimiter = rateLimit({
    endpoint: "forgot-password",
    max: Number(process.env.RATE_LIMIT_FORGOT_MAX || 5)
});

const resetPasswordLimiter = rateLimit({
    endpoint: "reset-password",
    max: Number(process.env.RATE_LIMIT_RESET_MAX || 10)
});

const refreshLimiter = rateLimit({
    endpoint: "refresh",
    max: Number(process.env.RATE_LIMIT_REFRESH_MAX || 120)
});


// ======================================================
// PUBLIC ROUTES
// ======================================================
//
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/refresh
// POST /api/auth/logout
// POST /api/auth/forgot-password
// POST /api/auth/reset-password
// POST /api/auth/verify-email
//
// ======================================================

router.post(
    "/register",
    registerLimiter,
    register
);

router.post(
    "/login",
    loginLimiter,
    login
);

router.post(
    "/refresh",
    refreshLimiter,
    refresh
);

router.post(
    "/logout",
    logout
);

router.post(
    "/forgot-password",
    forgotPasswordLimiter,
    forgotPassword
);

router.post(
    "/reset-password",
    resetPasswordLimiter,
    resetPassword
);

router.post(
    "/verify-email",
    verifyEmail
);

router.get(
    "/verify-email",
    verifyEmail
);


// ======================================================
// PROTECTED ROUTES
// ======================================================
//
// GET    /api/auth/me
// POST   /api/auth/resend-verification
// GET    /api/auth/sessions
// DELETE /api/auth/sessions/:id
// POST   /api/auth/sessions/revoke-all
//
// ======================================================

router.get(
    "/me",
    authenticateToken,
    getMe
);

router.post(
    "/resend-verification",
    authenticateToken,
    resendVerification
);

router.get(
    "/sessions",
    authenticateToken,
    getSessions
);

router.post(
    "/sessions/revoke-all",
    authenticateToken,
    deleteAllSessions
);

router.delete(
    "/sessions/:id",
    authenticateToken,
    deleteSession
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;
