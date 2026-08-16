const express = require("express");

const router = express.Router();

const shipmentController = require("../controllers/shipmentController");
const etaController = require("../controllers/etaController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");

router.use(authenticateToken);

// GET /api/shipments
router.get(
    "/",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    shipmentController.getAllShipments
);

// GET /api/shipments/tracking/:trackingNumber
router.get(
    "/tracking/:trackingNumber",
    authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"),
    shipmentController.getShipmentByTrackingNumber
);

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

// DELETE /api/shipments/:id
router.delete(
    "/:id",
    authorizeRoles("ADMIN"),
    shipmentController.deleteShipment
);

module.exports = router;
