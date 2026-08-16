const express = require("express");

const router = express.Router();


// ======================================================
// CONTROLLER
// ======================================================

const {
    getAllNotifications,
    getNotificationById,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    getShipmentNotifications,
    streamNotifications
} = require("../controllers/notificationController");


// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

const {
    authenticateToken
} = require("../middleware/authMiddleware");


// ======================================================
// ALL NOTIFICATION ROUTES REQUIRE LOGIN
// ======================================================

router.use(authenticateToken);


// ======================================================
// GET ALL NOTIFICATIONS
// ======================================================
//
// GET /api/notifications
//
// Optional:
//
// ?status=UNREAD
// ?type=DELIVERED
// ?priority=HIGH
// ?channel=IN_APP
// ?customer_id=1
//
// ======================================================

router.get(
    "/",
    getAllNotifications
);


// ======================================================
// LIVE STREAM (SSE)
// ======================================================
//
// GET /api/notifications/stream
//
// IMPORTANT:
// This route comes before /:id, otherwise "stream" would be parsed as a
// notification id and fail integer conversion.
//
// ======================================================

router.get(
    "/stream",
    streamNotifications
);


// ======================================================
// GET UNREAD COUNT
// ======================================================
//
// GET /api/notifications/unread-count
//
// IMPORTANT:
// This route comes before /:id.
//
// ======================================================

router.get(
    "/unread-count",
    getUnreadNotificationCount
);


// ======================================================
// MARK ALL AS READ
// ======================================================
//
// PATCH /api/notifications/read-all
//
// IMPORTANT:
// This route comes before /:id.
//
// ======================================================

router.patch(
    "/read-all",
    markAllNotificationsAsRead
);


// ======================================================
// GET NOTIFICATIONS FOR SHIPMENT
// ======================================================
//
// GET /api/notifications/shipment/:shipmentId
//
// IMPORTANT:
// This route comes before /:id.
//
// ======================================================

router.get(
    "/shipment/:shipmentId",
    getShipmentNotifications
);


// ======================================================
// GET NOTIFICATION BY ID
// ======================================================
//
// GET /api/notifications/:id
//
// ======================================================

router.get(
    "/:id",
    getNotificationById
);


// ======================================================
// MARK NOTIFICATION AS READ
// ======================================================
//
// PATCH /api/notifications/:id/read
//
// Ownership is checked inside the controller.
//
// ======================================================

router.patch(
    "/:id/read",
    markNotificationAsRead
);


// ======================================================
// DELETE NOTIFICATION
// ======================================================
//
// DELETE /api/notifications/:id
//
// Ownership is checked inside the controller.
//
// ======================================================

router.delete(
    "/:id",
    deleteNotification
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;