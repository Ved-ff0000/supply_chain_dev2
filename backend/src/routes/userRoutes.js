const express = require("express");

const router = express.Router();

const userController =
    require("../controllers/userController");

const {
    authenticate,
    authorize
} = require("../middleware/authMiddleware");


// ========================================
// ALL USER MANAGEMENT ROUTES
// REQUIRE LOGIN + ADMIN ROLE
// ========================================

router.use(authenticate);

router.use(
    authorize("ADMIN")
);


// ========================================
// GET ALL USERS
// ========================================

router.get(
    "/",
    userController.getAllUsers
);


// ========================================
// GET USER BY ID
// ========================================

router.get(
    "/:id",
    userController.getUserById
);


// ========================================
// UPDATE USER
// ========================================

router.put(
    "/:id",
    userController.updateUser
);


// ========================================
// CHANGE ROLE
// ========================================

router.patch(
    "/:id/role",
    userController.updateUserRole
);


// ========================================
// ACTIVATE / DEACTIVATE
// ========================================

router.patch(
    "/:id/status",
    userController.updateUserStatus
);


// ========================================
// DELETE USER
// ========================================

router.delete(
    "/:id",
    userController.deleteUser
);


module.exports = router;