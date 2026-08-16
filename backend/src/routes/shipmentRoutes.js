const express = require("express");

const router = express.Router();

const shipmentController = require("../controllers/shipmentController");
const etaController = require("../controllers/etaController");
const shipmentRequestController = require("../controllers/shipmentRequestController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

router.use(authenticateToken);


// ======================================================
// COLLECTION
// ======================================================

// GET /api/shipments
router.get(
    "/",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    shipmentController.getAllShipments
);


// ======================================================
// STATIC PATHS
// ======================================================
//
// IMPORTANT:
// Every literal path below must be declared before the "/:id" routes,
// otherwise Express matches "bulk-status" / "request" as an :id and the
// handler fails converting it to an integer.
//
// ======================================================

// PATCH /api/shipments/bulk-status  (Feature 8)
router.patch(
    "/bulk-status",
    authorizeRoles("OPERATIONS", "ADMIN"),
    shipmentController.bulkUpdateShipmentStatus
);

// POST /api/shipments/request  (Feature 6)
router.post(
    "/request",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    shipmentRequestController.createShipmentRequest
);

// GET /api/shipments/requests/pending
router.get(
    "/requests/pending",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    shipmentRequestController.getPendingRequests
);

// GET /api/shipments/tracking/:trackingNumber
router.get(
    "/tracking/:trackingNumber",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    shipmentController.getShipmentByTrackingNumber
);


// ======================================================
// SINGLE SHIPMENT
// ======================================================

// GET /api/shipments/:id/eta
router.get(
    "/:id/eta",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    etaController.getShipmentETA
);

// GET /api/shipments/:id
router.get(
    "/:id",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    shipmentController.getShipmentById
);

// POST /api/shipments
router.post(
    "/",
    authorizeRoles("OPERATIONS", "ADMIN"),
    shipmentController.createShipment
);

// POST /api/shipments/:id/approve  (Feature 6)
router.post(
    "/:id/approve",
    authorizeRoles("OPERATIONS", "ADMIN"),
    shipmentRequestController.approveShipmentRequest
);

// POST /api/shipments/:id/reject  (Feature 6)
router.post(
    "/:id/reject",
    authorizeRoles("OPERATIONS", "ADMIN"),
    shipmentRequestController.rejectShipmentRequest
);

// PATCH /api/shipments/:id/status
router.patch(
    "/:id/status",
    authorizeRoles("OPERATIONS", "ADMIN"),
    shipmentController.updateShipmentStatus
);

// PATCH /api/shipments/:id
router.patch(
    "/:id",
    authorizeRoles("OPERATIONS", "ADMIN"),
    shipmentController.updateShipment
);

// DELETE /api/shipments/:id  (soft delete)
router.delete(
    "/:id",
    authorizeRoles("ADMIN"),
    shipmentController.deleteShipment
);

module.exports = router;
