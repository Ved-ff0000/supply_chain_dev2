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
    getCustomsHoldFrequency,
    getActiveShipmentsCount,
    getDelays24h,
    getUnreadNotificationsCount,
    exportDashboardCsv
} = require("../controllers/dashboardController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");


const router = express.Router();


// All dashboard endpoints require a signed-in user.
router.use(authenticateToken);


// ======================================================
// STAFF-ONLY FLEET ANALYTICS
// ======================================================
//
// These aggregate across every customer, so they stay restricted.
//
// ======================================================

router.get(
    "/summary",
    authorizeRoles("OPERATIONS", "ADMIN"),
    getDashboardSummary
);

router.get(
    "/shipments/status",
    authorizeRoles("OPERATIONS", "ADMIN"),
    getShipmentsByStatus
);

router.get(
    "/shipments/priority",
    authorizeRoles("OPERATIONS", "ADMIN"),
    getShipmentsByPriority
);

router.get(
    "/shipments/carriers",
    authorizeRoles("OPERATIONS", "ADMIN"),
    getShipmentsByCarrier
);

router.get(
    "/recent-shipments",
    authorizeRoles("OPERATIONS", "ADMIN"),
    getRecentShipments
);

router.get(
    "/customs-hold-frequency",
    authorizeRoles("OPERATIONS", "ADMIN"),
    getCustomsHoldFrequency
);


// ======================================================
// ROLE-SCOPED ANALYTICS
// ======================================================
//
// Customers may read these; the controller narrows every query to their own
// customer_id, so the same endpoint safely powers both dashboards.
//
// ======================================================

router.get(
    "/deliveries-over-time",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    getDeliveriesOverTime
);

router.get(
    "/avg-transit-time",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    getAvgTransitTime
);

router.get(
    "/on-time-rate",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    getOnTimeRate
);


// ======================================================
// KPI CARD ENDPOINTS
// ======================================================
//
// GET /api/dashboard/active-shipments-count
// GET /api/dashboard/delays-24h
// GET /api/dashboard/unread-notifications-count
//
// ======================================================

router.get(
    "/active-shipments-count",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    getActiveShipmentsCount
);

router.get(
    "/delays-24h",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    getDelays24h
);

router.get(
    "/unread-notifications-count",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    getUnreadNotificationsCount
);


// ======================================================
// CSV EXPORT
// ======================================================
//
// GET /api/dashboard/export?dataset=deliveries&range=30d
//
// ======================================================

router.get(
    "/export",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    exportDashboardCsv
);


module.exports = router;
