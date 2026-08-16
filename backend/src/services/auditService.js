const pool = require("../config/database");

/**
 * Log an audit trail entry for create/update/status-change/delete operations.
 * Supports passing an active transaction `client` to ensure atomic logging.
 */
const logAuditEvent = async ({
    entityType,
    entityId,
    action,
    changedBy = null,
    oldValue = null,
    newValue = null,
    client = null
}) => {
    const db = client || pool;

    try {
        const normalizedEntityType = String(entityType).trim().toUpperCase();
        const normalizedAction = String(action).trim().toUpperCase();
        const normalizedEntityId = Number(entityId);
        const normalizedChangedBy = changedBy ? Number(changedBy) : null;

        const oldValueJson = oldValue ? JSON.stringify(oldValue) : null;
        const newValueJson = newValue ? JSON.stringify(newValue) : null;

        const result = await db.query(
            `
            INSERT INTO audit_log (
                entity_type,
                entity_id,
                action,
                changed_by,
                old_value,
                new_value,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, CURRENT_TIMESTAMP)
            RETURNING *
            `,
            [
                normalizedEntityType,
                normalizedEntityId,
                normalizedAction,
                normalizedChangedBy,
                oldValueJson,
                newValueJson
            ]
        );

        return result.rows[0];
    } catch (error) {
        console.error("[AuditService] Failed to record audit log:", error.message);
        // Do not fail parent transactions on logging errors unless critical
        return null;
    }
};

/**
 * Query audit log records with filtering and pagination.
 */
const getAuditLogs = async (filters = {}) => {
    const {
        entity_type,
        entity_id,
        changed_by,
        action,
        date_from,
        date_to,
        limit = 50,
        page = 1
    } = filters;

    const conditions = [];
    const values = [];

    if (entity_type) {
        values.push(String(entity_type).trim().toUpperCase());
        conditions.push(`a.entity_type = $${values.length}`);
    }

    if (entity_id) {
        values.push(Number(entity_id));
        conditions.push(`a.entity_id = $${values.length}`);
    }

    if (changed_by) {
        values.push(Number(changed_by));
        conditions.push(`a.changed_by = $${values.length}`);
    }

    if (action) {
        values.push(String(action).trim().toUpperCase());
        conditions.push(`a.action = $${values.length}`);
    }

    if (date_from) {
        values.push(date_from);
        conditions.push(`a.created_at >= $${values.length}::timestamp`);
    }

    if (date_to) {
        values.push(date_to);
        conditions.push(`a.created_at <= $${values.length}::timestamp`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total matches
    const countResult = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM audit_log a
        ${whereClause}
        `,
        values
    );

    const total = parseInt(countResult.rows[0]?.total || 0, 10);
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const parsedPage = Math.max(Number(page) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    // Fetch records with user metadata
    const queryValues = [...values, parsedLimit, offset];
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;

    const result = await pool.query(
        `
        SELECT 
            a.id,
            a.entity_type,
            a.entity_id,
            a.action,
            a.changed_by,
            u.name AS changed_by_name,
            u.email AS changed_by_email,
            u.role AS changed_by_role,
            a.old_value,
            a.new_value,
            a.created_at
        FROM audit_log a
        LEFT JOIN users u ON a.changed_by = u.id
        ${whereClause}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
        `,
        queryValues
    );

    return {
        total,
        page: parsedPage,
        limit: parsedLimit,
        total_pages: Math.ceil(total / parsedLimit),
        count: result.rows.length,
        logs: result.rows
    };
};

module.exports = {
    logAuditEvent,
    getAuditLogs
};
