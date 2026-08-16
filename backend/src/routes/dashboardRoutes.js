const express = require("express");

const {
    getDashboardSummary,
    getShipmentsByStatus,
    getShipmentsByPriority,
    getShipmentsByCarrier,
    getRecentShipments,
    getDeliveriesOverTime,
    getAvgTransitTime,
    getOnTimeRate,
    getCustomsHoldFrequency
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


// ======================================================
// DELIVERIES OVER TIME (TIME-SERIES)
// ======================================================

router.get(
    "/deliveries-over-time",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getDeliveriesOverTime
);


// ======================================================
// AVERAGE TRANSIT TIME BY CARRIER
// ======================================================

router.get(
    "/avg-transit-time",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getAvgTransitTime
);


// ======================================================
// ON-TIME DELIVERY RATE
// ======================================================

router.get(
    "/on-time-rate",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getOnTimeRate
);


// ======================================================
// CUSTOMS HOLD FREQUENCY
// ======================================================

router.get(
    "/customs-hold-frequency",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    getCustomsHoldFrequency
);


module.exports = router;