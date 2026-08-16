/**
 * Customer self-service shipment requests (Feature 6).
 *
 * A CUSTOMER submits a request, which is stored as a real shipment in the
 * PENDING_APPROVAL state. OPERATIONS/ADMIN then approve it (PENDING_APPROVAL
 * -> CREATED) or reject it (-> CANCELLED). Both transitions run through the
 * shared statusChangeService, so approval emits the usual event, audit entry
 * and notifications.
 */

const pool = require("../config/database");

const {
    applyStatusChange
} = require("../services/statusChangeService");

const { logAuditEvent } = require("../services/auditService");

const {
    SHIPMENT_STATUS
} = require("../constants/shipmentConstants");


/**
 * Requests get a readable, unique tracking number up front so the customer
 * has something to quote before operations approve it.
 */
const generateRequestTrackingNumber = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(
            Math.random() * 9000 + 1000
        )}`;

        const existing = await pool.query(
            "SELECT 1 FROM shipments WHERE tracking_number = $1",
            [candidate]
        );

        if (existing.rows.length === 0) {
            return candidate;
        }
    }

    throw new Error("Could not allocate a tracking number");
};


// ======================================================
// CREATE SHIPMENT REQUEST
// ======================================================
//
// POST /api/shipments/request
//
// Body:
// {
//   "carrier_id": 1,
//   "origin": "Hyderabad, IN",
//   "destination": "Rotterdam, NL",
//   "priority": "HIGH",
//   "expected_delivery": "2026-09-01T10:00:00Z",
//   "notes": "Fragile"
// }
//
// ======================================================

const createShipmentRequest = async (req, res) => {
    try {
        const {
            carrier_id,
            origin,
            destination,
            priority,
            expected_delivery,
            notes
        } = req.body || {};

        if (!carrier_id || !origin || !destination) {
            return res.status(400).json({
                success: false,
                message:
                    "carrier_id, origin and destination are required"
            });
        }

        // --------------------------------------------------
        // Resolve the requesting customer
        // --------------------------------------------------
        //
        // A CUSTOMER can only ever request for themselves. Staff raising a
        // request on a customer's behalf must name the customer.

        const role = String(req.user.role || "").toUpperCase();

        const customerId =
            role === "CUSTOMER"
                ? req.user.customer_id
                : Number(req.body.customer_id) || null;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message:
                    role === "CUSTOMER"
                        ? "Your account is not linked to a customer record"
                        : "customer_id is required"
            });
        }

        // --------------------------------------------------
        // Validate references
        // --------------------------------------------------

        const carrierResult = await pool.query(
            "SELECT id, name FROM carriers WHERE id = $1 AND is_deleted = FALSE",
            [Number(carrier_id)]
        );

        if (carrierResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Carrier not found"
            });
        }

        const customerResult = await pool.query(
            "SELECT id, name FROM customers WHERE id = $1 AND is_deleted = FALSE",
            [customerId]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const trackingNumber = await generateRequestTrackingNumber();

        const normalizedPriority = priority
            ? String(priority).trim().toUpperCase()
            : "NORMAL";

        // --------------------------------------------------
        // Insert as PENDING_APPROVAL + opening event
        // --------------------------------------------------

        const client = await pool.connect();
        let shipment;

        try {
            await client.query("BEGIN");

            const insertResult = await client.query(
                `
                INSERT INTO shipments (
                    tracking_number,
                    carrier_id,
                    customer_id,
                    origin,
                    destination,
                    status,
                    priority,
                    expected_delivery,
                    requested_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING
                    id, tracking_number, carrier_id, customer_id,
                    origin, destination, status, priority,
                    expected_delivery, requested_by, created_at
                `,
                [
                    trackingNumber,
                    Number(carrier_id),
                    customerId,
                    String(origin).trim(),
                    String(destination).trim(),
                    SHIPMENT_STATUS.PENDING_APPROVAL,
                    normalizedPriority,
                    expected_delivery || null,
                    req.user.id
                ]
            );

            shipment = insertResult.rows[0];

            await client.query(
                `
                INSERT INTO shipment_events (
                    shipment_id, status, location, description, event_time
                )
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                `,
                [
                    shipment.id,
                    SHIPMENT_STATUS.PENDING_APPROVAL,
                    String(origin).trim(),
                    notes
                        ? `Shipment requested by customer. Notes: ${String(notes).slice(0, 400)}`
                        : "Shipment requested by customer, awaiting approval"
                ]
            );

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }

        await logAuditEvent({
            entityType: "SHIPMENT",
            entityId: shipment.id,
            action: "REQUEST_CREATED",
            changedBy: req.user.id,
            newValue: {
                tracking_number: shipment.tracking_number,
                status: shipment.status,
                origin: shipment.origin,
                destination: shipment.destination,
                priority: shipment.priority
            }
        });

        return res.status(201).json({
            success: true,
            message:
                "Shipment request submitted and awaiting operations approval",
            data: shipment
        });
    } catch (error) {
        console.error("Error creating shipment request:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to submit shipment request",
            error: error.message
        });
    }
};


// ======================================================
// LIST PENDING REQUESTS
// ======================================================
//
// GET /api/shipments/requests/pending
//
// ======================================================

const getPendingRequests = async (req, res) => {
    try {
        const role = String(req.user.role || "").toUpperCase();

        const values = [];
        let scopeClause = "";

        if (role === "CUSTOMER") {
            values.push(req.user.customer_id || -1);
            scopeClause = ` AND s.customer_id = $${values.length}`;
        }

        const result = await pool.query(
            `
            SELECT
                s.id,
                s.tracking_number,
                s.origin,
                s.destination,
                s.status,
                s.priority,
                s.expected_delivery,
                s.created_at,
                c.name AS customer,
                ca.name AS carrier,
                u.name AS requested_by_name,
                u.email AS requested_by_email
            FROM shipments s
            JOIN customers c ON c.id = s.customer_id
            JOIN carriers ca ON ca.id = s.carrier_id
            LEFT JOIN users u ON u.id = s.requested_by
            WHERE s.status = 'PENDING_APPROVAL'
              AND s.is_deleted = FALSE
              ${scopeClause}
            ORDER BY s.created_at ASC
            `,
            values
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error listing pending requests:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load pending requests",
            error: error.message
        });
    }
};


// ======================================================
// APPROVE / REJECT A REQUEST
// ======================================================
//
// POST /api/shipments/:id/approve
// POST /api/shipments/:id/reject
//
// Both delegate to the shared status pipeline.
//
// ======================================================

const decideRequest = (decision) => async (req, res) => {
    try {
        const shipmentId = Number(req.params.id);

        const targetStatus =
            decision === "APPROVE"
                ? SHIPMENT_STATUS.CREATED
                : SHIPMENT_STATUS.CANCELLED;

        const existing = await pool.query(
            `
            SELECT id, status, tracking_number
            FROM shipments
            WHERE id = $1 AND is_deleted = FALSE
            `,
            [shipmentId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Shipment not found"
            });
        }

        if (existing.rows[0].status !== SHIPMENT_STATUS.PENDING_APPROVAL) {
            return res.status(400).json({
                success: false,
                message: `Shipment is not awaiting approval (current status: ${existing.rows[0].status})`
            });
        }

        const result = await applyStatusChange({
            shipmentId,
            status: targetStatus,
            changedBy: req.user.id,
            description:
                decision === "APPROVE"
                    ? "Shipment request approved by operations"
                    : `Shipment request rejected${
                          req.body && req.body.reason
                              ? `: ${String(req.body.reason).slice(0, 300)}`
                              : ""
                      }`,
            auditAction:
                decision === "APPROVE"
                    ? "REQUEST_APPROVED"
                    : "REQUEST_REJECTED"
        });

        if (!result.ok) {
            return res.status(result.statusCode || 400).json({
                success: false,
                message: result.reason
            });
        }

        if (decision === "APPROVE") {
            await pool.query(
                `
                UPDATE shipments
                SET approved_by = $1, approved_at = CURRENT_TIMESTAMP
                WHERE id = $2
                `,
                [req.user.id, shipmentId]
            );
        }

        return res.status(200).json({
            success: true,
            message:
                decision === "APPROVE"
                    ? "Shipment request approved"
                    : "Shipment request rejected",
            data: result.shipment,
            notification: result.notification
        });
    } catch (error) {
        console.error(`Error processing ${decision} request:`, error);

        return res.status(500).json({
            success: false,
            message: "Failed to process shipment request",
            error: error.message
        });
    }
};


module.exports = {
    createShipmentRequest,
    getPendingRequests,
    approveShipmentRequest: decideRequest("APPROVE"),
    rejectShipmentRequest: decideRequest("REJECT")
};
