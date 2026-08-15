const express = require("express");


// ======================================================
// CONTROLLER
// ======================================================

const {
    getCustomerById,
    updateCustomer,
    getNotificationPreferences,
    updateNotificationPreferences
} = require("../controllers/customerController");


// ======================================================
// AUTH MIDDLEWARE
// ======================================================

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");


const router = express.Router();


// ======================================================
// CUSTOMER PROFILE
// ======================================================

router.get(
    "/:customerId",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    getCustomerById
);


router.patch(
    "/:customerId",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    updateCustomer
);


// ======================================================
// NOTIFICATION PREFERENCES
// ======================================================

router.get(
    "/:customerId/notification-preferences",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    getNotificationPreferences
);


router.patch(
    "/:customerId/notification-preferences",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    updateNotificationPreferences
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;