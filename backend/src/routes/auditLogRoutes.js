const express = require("express");
const { getAuditLogsController } = require("../controllers/auditLogController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken);

// GET /api/audit-log (ADMIN only)
router.get(
    "/",
    authorizeRoles("ADMIN"),
    getAuditLogsController
);

module.exports = router;
