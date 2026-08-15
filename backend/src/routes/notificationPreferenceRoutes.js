const express = require("express");

const {
    getNotificationPreferences,
    updateNotificationPreferences,
    resetNotificationPreferences
} = require("../controllers/notificationPreferenceController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");


const router = express.Router();


// ======================================================
// GET PREFERENCES
// ======================================================

router.get(
    "/",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    getNotificationPreferences
);


// ======================================================
// UPDATE PREFERENCES
// ======================================================

router.put(
    "/",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    updateNotificationPreferences
);


// ======================================================
// RESET PREFERENCES
// ======================================================

router.put(
    "/reset",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    resetNotificationPreferences
);


module.exports = router;