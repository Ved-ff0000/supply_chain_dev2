const express = require("express");


// ======================================================
// CONTROLLER
// ======================================================

const {
    getAllCarriers,
    getCarrierById,
    createCarrier,
    updateCarrier,
    deleteCarrier
} = require("../controllers/carrierController");


// ======================================================
// AUTH MIDDLEWARE
// ======================================================

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");


const router = express.Router();


// ======================================================
// GET ALL CARRIERS
// ======================================================
//
// GET /api/carriers
//
// ======================================================

router.get(
    "/",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    getAllCarriers
);


// ======================================================
// GET CARRIER BY ID
// ======================================================
//
// GET /api/carriers/:carrierId
//
// ======================================================

router.get(
    "/:carrierId",
    authenticateToken,
    authorizeRoles(
        "CUSTOMER",
        "OPERATIONS",
        "ADMIN"
    ),
    getCarrierById
);


// ======================================================
// CREATE CARRIER
// ======================================================
//
// POST /api/carriers
//
// Only ADMIN
//
// ======================================================

router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN"),
    createCarrier
);


// ======================================================
// UPDATE CARRIER
// ======================================================
//
// PATCH /api/carriers/:carrierId
//
// ADMIN + OPERATIONS
//
// ======================================================

router.patch(
    "/:carrierId",
    authenticateToken,
    authorizeRoles(
        "OPERATIONS",
        "ADMIN"
    ),
    updateCarrier
);


// ======================================================
// DELETE CARRIER
// ======================================================
//
// DELETE /api/carriers/:carrierId
//
// Only ADMIN
//
// ======================================================

router.delete(
    "/:carrierId",
    authenticateToken,
    authorizeRoles("ADMIN"),
    deleteCarrier
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;