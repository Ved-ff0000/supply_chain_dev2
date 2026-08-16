const express = require("express");

const router = express.Router();

const filterController = require("../controllers/filterController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/authMiddleware");


// Saved filters are personal to the signed-in user, so every role may manage
// their own presets.
router.use(authenticateToken);
router.use(authorizeRoles("CUSTOMER", "OPERATIONS", "ADMIN"));


// GET    /api/filters
router.get("/", filterController.getFilters);

// POST   /api/filters
router.post("/", filterController.createFilter);

// GET    /api/filters/:id
router.get("/:id", filterController.getFilterById);

// PATCH  /api/filters/:id
router.patch("/:id", filterController.updateFilter);

// DELETE /api/filters/:id
router.delete("/:id", filterController.deleteFilter);


module.exports = router;
