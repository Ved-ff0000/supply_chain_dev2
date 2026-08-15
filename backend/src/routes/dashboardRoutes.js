const express = require("express");

const {
    getDashboardSummary,
    getShipmentsByStatus,
    getShipmentsByPriority,
    getShipmentsByCarrier,
    getRecentShipments
} = require("../controllers/dashboardController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");


const router = express.Router();


// ======================================================
// DASHBOARD SUMMARY
// ======================================================

router.get(
    "/summary",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getDashboardSummary
);


// ======================================================
// SHIPMENTS BY STATUS
// ======================================================

router.get(
    "/shipments/status",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getShipmentsByStatus
);


// ======================================================
// SHIPMENTS BY PRIORITY
// ======================================================

router.get(
    "/shipments/priority",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getShipmentsByPriority
);


// ======================================================
// SHIPMENTS BY CARRIER
// ======================================================

router.get(
    "/shipments/carriers",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getShipmentsByCarrier
);


// ======================================================
// RECENT SHIPMENTS
// ======================================================

router.get(
    "/recent-shipments",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getRecentShipments
);


module.exports = router;