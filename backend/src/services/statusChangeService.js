/**
 * Canonical shipment status-change pipeline.
 *
 * Every status change in the application funnels through applyStatusChange:
 * single updates, bulk updates (Feature 8) and request approvals (Feature 6).
 * The validation, event record, audit entry and notification fan-out therefore
 * exist in exactly one place.
 *
 * Order of operations:
 *   1. validate the transition against statusTransitions.js
 *   2. update the shipment + write the shipment_event atomically
 *   3. write the audit entry
 *   4. hand off to the notification engine (in-app + email + webhook + SSE)
 */

const pool = require("../config/database");

const {
    isValidStatusTransition
} = require("../constants/statusTransitions");

const {
    createShipmentNotification,
    generateShipmentNotification
} = require("./notificationService");

const { logAuditEvent } = require("./auditService");


/**
 * Apply a validated status change to one shipment.
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   skipped?: boolean,
 *   reason?: string,
 *   statusCode?: number,
 *   shipment?: object,
 *   notification?: object|null
 * }>}
 */
const applyStatusChange = async ({
    shipmentId,
    status,
    changedBy = null,
    location = null,
    description = null,
    auditAction = "STATUS_CHANGE"
}) => {
    const id = Number(shipmentId);

    if (!Number.isInteger(id) || id <= 0) {
        return {
            ok: false,
            statusCode: 400,
            reason: "Invalid shipment ID"
        };
    }

    if (!status || typeof status !== "string") {
        return {
            ok: false,
            statusCode: 400,
            reason: "Status is required"
        };
    }

    const normalizedStatus = status.trim().toUpperCase();

    // --------------------------------------------------
    // Load current state
    // --------------------------------------------------

    const currentResult = await pool.query(
        `
        SELECT
            id,
            tracking_number,
            customer_id,
            carrier_id,
            status,
            priority,
            origin,
            destination,
            expected_delivery,
            actual_delivery
        FROM shipments
        WHERE id = $1
          AND is_deleted = FALSE
        `,
        [id]
    );

    if (currentResult.rows.length === 0) {
        return {
            ok: false,
            statusCode: 404,
            reason: "Shipment not found"
        };
    }

    const current = currentResult.rows[0];

    // --------------------------------------------------
    // No-op
    // --------------------------------------------------

    if (current.status === normalizedStatus) {
        return {
            ok: true,
            skipped: true,
            reason: "Shipment already has this status",
            shipment: current,
            notification: null
        };
    }

    // --------------------------------------------------
    // Validate against the state machine
    // --------------------------------------------------

    if (!isValidStatusTransition(current.status, normalizedStatus)) {
        return {
            ok: false,
            statusCode: 400,
            reason: `Invalid status transition from ${current.status} to ${normalizedStatus}`,
            shipment: current
        };
    }

    // --------------------------------------------------
    // Update + event, atomically
    // --------------------------------------------------

    const client = await pool.connect();
    let updated;

    try {
        await client.query("BEGIN");

        const updateResult = await client.query(
            `
            UPDATE shipments
            SET
                status = $1::varchar,
                actual_delivery =
                    CASE
                        WHEN $1::varchar = 'DELIVERED'
                        THEN CURRENT_TIMESTAMP
                        ELSE actual_delivery
                    END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING
                id,
                tracking_number,
                customer_id,
                carrier_id,
                origin,
                destination,
                status,
                priority,
                expected_delivery,
                actual_delivery,
                created_at,
                updated_at
            `,
            [normalizedStatus, id]
        );

        updated = updateResult.rows[0];

        await client.query(
            `
            INSERT INTO shipment_events (
                shipment_id,
                status,
                location,
                description,
                event_time
            )
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            `,
            [
                id,
                normalizedStatus,
                location,
                description ||
                    `Shipment status changed to ${normalizedStatus}`
            ]
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    // --------------------------------------------------
    // Audit trail
    // --------------------------------------------------

    await logAuditEvent({
        entityType: "SHIPMENT",
        entityId: id,
        action: auditAction,
        changedBy,
        oldValue: { status: current.status },
        newValue: {
            status: normalizedStatus,
            actual_delivery: updated.actual_delivery
        }
    });

    // --------------------------------------------------
    // Notifications (in-app + email + webhook + SSE)
    // --------------------------------------------------

    let notification = null;

    try {
        const notificationData = generateShipmentNotification(
            updated,
            normalizedStatus
        );

        const notificationResult = await createShipmentNotification({
            shipmentId: updated.id,
            status: normalizedStatus,
            title: notificationData.title,
            message: notificationData.message,
            priority: notificationData.priority
        });

        if (notificationResult.created) {
            notification = notificationResult.notification;
        }
    } catch (notificationError) {
        console.error(
            "[StatusChangeService] Notification dispatch failed:",
            notificationError.message
        );
    }

    return {
        ok: true,
        skipped: false,
        previousStatus: current.status,
        shipment: updated,
        notification
    };
};


/**
 * Apply the same status to many shipments (Feature 8).
 *
 * Each shipment is processed independently so one invalid transition cannot
 * abort the rest of the batch; the caller receives a per-shipment report.
 */
const applyBulkStatusChange = async ({
    shipmentIds,
    status,
    changedBy = null,
    description = null
}) => {
    const ids = Array.isArray(shipmentIds)
        ? [...new Set(shipmentIds.map(Number).filter(Number.isInteger))]
        : [];

    if (ids.length === 0) {
        const error = new Error("shipment_ids must be a non-empty array");
        error.statusCode = 400;
        throw error;
    }

    const MAX_BATCH = Number(process.env.BULK_STATUS_MAX || 200);

    if (ids.length > MAX_BATCH) {
        const error = new Error(
            `Cannot update more than ${MAX_BATCH} shipments in one request`
        );
        error.statusCode = 400;
        throw error;
    }

    const succeeded = [];
    const failed = [];
    const skipped = [];

    for (const id of ids) {
        try {
            const result = await applyStatusChange({
                shipmentId: id,
                status,
                changedBy,
                description
            });

            if (!result.ok) {
                failed.push({
                    shipment_id: id,
                    reason: result.reason,
                    tracking_number: result.shipment
                        ? result.shipment.tracking_number
                        : null
                });
                continue;
            }

            if (result.skipped) {
                skipped.push({
                    shipment_id: id,
                    reason: result.reason,
                    tracking_number: result.shipment.tracking_number
                });
                continue;
            }

            succeeded.push({
                shipment_id: id,
                tracking_number: result.shipment.tracking_number,
                previous_status: result.previousStatus,
                new_status: result.shipment.status,
                notified: Boolean(result.notification)
            });
        } catch (error) {
            console.error(
                `[StatusChangeService] Bulk update failed for shipment ${id}:`,
                error.message
            );

            failed.push({
                shipment_id: id,
                reason: error.message
            });
        }
    }

    return {
        requested: ids.length,
        updated_count: succeeded.length,
        skipped_count: skipped.length,
        failed_count: failed.length,
        updated: succeeded,
        skipped,
        failed
    };
};


module.exports = {
    applyStatusChange,
    applyBulkStatusChange
};
