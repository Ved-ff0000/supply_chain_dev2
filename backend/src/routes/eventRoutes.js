
const express = require("express");

const router = express.Router();


// ======================================================
// CONTROLLER
// ======================================================

const {
    getShipmentEvents,
    getLatestShipmentEvent,
    createShipmentEvent,
    deleteShipmentEvent
} = require("../controllers/eventController");


// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

const {
    authenticateToken
} = require("../middleware/authMiddleware");


// ======================================================
// ALL EVENT ROUTES REQUIRE LOGIN
// ======================================================

router.use(authenticateToken);


// ======================================================
// GET ALL EVENTS FOR A SHIPMENT
// ======================================================
//
// GET /api/events/shipment/:shipmentId
//
// ======================================================

router.get(
    "/shipment/:shipmentId",
    getShipmentEvents
);


// ======================================================
// GET LATEST EVENT
// ======================================================
//
// GET /api/events/shipment/:shipmentId/latest
//
// IMPORTANT:
// This route is defined before any generic :eventId
// route.
//
// ======================================================

router.get(
    "/shipment/:shipmentId/latest",
    getLatestShipmentEvent
);


// ======================================================
// CREATE SHIPMENT EVENT
// ======================================================
//
// POST /api/events/shipment/:shipmentId
//
// Example body:
//
// {
//     "status": "IN_TRANSIT",
//     "location": "Hyderabad",
//     "description": "Shipment departed facility"
// }
//
// ======================================================

router.post(
    "/shipment/:shipmentId",
    createShipmentEvent
);


// ======================================================
// DELETE EVENT
// ======================================================
//
// DELETE /api/events/:eventId
//
// ======================================================

router.delete(
    "/:eventId",
    deleteShipmentEvent
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;

