const { getAuditLogs } = require("../services/auditService");

/**
 * GET /api/audit-log
 * Query audit trail logs with filtering by entity_type, entity_id, changed_by, action, and date range.
 * Restricted to ADMIN role.
 */
const getAuditLogsController = async (req, res) => {
    try {
        const {
            entity_type,
            entity_id,
            changed_by,
            action,
            date_from,
            date_to,
            limit,
            page
        } = req.query;

        const result = await getAuditLogs({
            entity_type,
            entity_id,
            changed_by,
            action,
            date_from,
            date_to,
            limit,
            page
        });

        return res.status(200).json({
            success: true,
            message: "Audit logs retrieved successfully",
            data: result
        });
    } catch (error) {
        console.error("Error retrieving audit logs:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve audit logs",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

module.exports = {
    getAuditLogsController
};
