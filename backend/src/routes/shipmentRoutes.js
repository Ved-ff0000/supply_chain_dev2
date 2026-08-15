
const express = require("express");

const router = express.Router();

const shipmentController =
    require("../controllers/shipmentController");


// ======================================================
// GET ALL SHIPMENTS
// ======================================================
//
// GET /api/shipments
//
// Optional query parameters:
//
// ?status=IN_TRANSIT
// ?priority=HIGH
// ?carrier_id=1
// ?customer_id=1
// ?search=FDX100001
//
// ======================================================

router.get(
    "/",
    shipmentController.getAllShipments
);


// ======================================================
// GET SHIPMENT BY TRACKING NUMBER
// ======================================================
//
// GET /api/shipments/tracking/:trackingNumber
//
// IMPORTANT:
// This route must come BEFORE /:id
//
// ======================================================

router.get(
    "/tracking/:trackingNumber",
    shipmentController.getShipmentByTrackingNumber
);


// ======================================================
// GET SHIPMENT BY ID
// ======================================================
//
// GET /api/shipments/:id
//
// ======================================================

router.get(
    "/:id",
    shipmentController.getShipmentById
);


// ======================================================
// CREATE SHIPMENT
// ======================================================
//
// POST /api/shipments
//
// Body:
//
// {
//     "tracking_number": "FDX100001",
//     "carrier_id": 1,
//     "customer_id": 1,
//     "origin": "Hyderabad",
//     "destination": "Mumbai",
//     "status": "IN_TRANSIT",
//     "priority": "HIGH",
//     "expected_delivery": "2026-08-20"
// }
//
// ======================================================

router.post(
    "/",
    shipmentController.createShipment
);


// ======================================================
// UPDATE SHIPMENT STATUS
// ======================================================
//
// PATCH /api/shipments/:id/status
//
// Body:
//
// {
//     "status": "DELIVERED"
// }
//
// ======================================================

router.patch(
    "/:id/status",
    shipmentController.updateShipmentStatus
);


// ======================================================
// UPDATE SHIPMENT
// ======================================================
//
// PATCH /api/shipments/:id
//
// Body:
//
// {
//     "origin": "Hyderabad",
//     "destination": "Bangalore",
//     "priority": "HIGH",
//     "expected_delivery": "2026-08-22"
// }
//
// ======================================================

router.patch(
    "/:id",
    shipmentController.updateShipment
);


// ======================================================
// DELETE SHIPMENT
// ======================================================
//
// DELETE /api/shipments/:id
//
// ======================================================

router.delete(
    "/:id",
    shipmentController.deleteShipment
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;

