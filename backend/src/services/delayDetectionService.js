const pool = require("../config/database");
const { processShipmentEvent } = require("./notificationEngine");
const { isValidStatusTransition } = require("../constants/statusTransitions");
const { TERMINAL_STATUSES, SHIPMENT_STATUS } = require("../constants/shipmentConstants");

/**
 * Priority-based inactivity thresholds (in hours).
 * If a shipment has not received any event update within this window, it is considered stalled/delayed.
 */
const INACTIVITY_THRESHOLD_HOURS = {
    URGENT: 24,
    HIGH: 48,
    NORMAL: 72,
    LOW: 120
};

/**
 * Scan for shipments that have exceeded their expected delivery date or inactivity threshold
 * and auto-transition them to DELAYED status.
 */
const checkAndFlagDelayedShipments = async (options = {}) => {
    const { dryRun = false } = options;

    const client = await pool.connect();
    const flaggedShipments = [];

    try {
        // Query active non-terminal shipments not already in DELAYED status
        const candidateResult = await client.query(
            `
            SELECT 
                s.id,
                s.tracking_number,
                s.customer_id,
                s.carrier_id,
                s.origin,
                s.destination,
                s.status,
                s.priority,
                s.expected_delivery,
                s.created_at,
                s.updated_at,
                COALESCE(MAX(e.event_time), s.created_at) AS last_event_time,
                (
                    SELECT location 
                    FROM shipment_events 
                    WHERE shipment_id = s.id 
                    ORDER BY event_time DESC 
                    LIMIT 1
                ) AS last_location
            FROM shipments s
            LEFT JOIN shipment_events e ON s.id = e.shipment_id
            WHERE s.status NOT IN ('DELIVERED', 'CANCELLED', 'LOST', 'RETURNED', 'DELAYED')
            GROUP BY s.id
            ORDER BY s.id ASC
            `
        );

        const now = new Date();
        const candidates = candidateResult.rows;

        for (const shipment of candidates) {
            let isDelayed = false;
            let delayReason = "";

            // 1. Check if expected_delivery is in the past
            if (shipment.expected_delivery) {
                const expectedDate = new Date(shipment.expected_delivery);
                if (now > expectedDate) {
                    isDelayed = true;
                    delayReason = `Shipment exceeded expected delivery date (${expectedDate.toISOString()})`;
                }
            }

            // 2. Check if shipment is stuck without updates past priority SLA threshold
            if (!isDelayed && shipment.last_event_time) {
                const lastEventDate = new Date(shipment.last_event_time);
                const thresholdHours = INACTIVITY_THRESHOLD_HOURS[String(shipment.priority).toUpperCase()] || 72;
                const hoursSinceLastEvent = (now.getTime() - lastEventDate.getTime()) / (3600 * 1000);

                if (hoursSinceLastEvent > thresholdHours) {
                    isDelayed = true;
                    delayReason = `Shipment stalled in status ${shipment.status} for ${Math.round(hoursSinceLastEvent)}h (exceeds ${thresholdHours}h SLA threshold)`;
                }
            }

            if (!isDelayed) {
                continue;
            }

            // Validate status transition rule
            if (!isValidStatusTransition(shipment.status, SHIPMENT_STATUS.DELAYED)) {
                console.warn(
                    `[DelayDetection] Skipping shipment ${shipment.id} (${shipment.tracking_number}): Invalid transition from ${shipment.status} to DELAYED`
                );
                continue;
            }

            if (dryRun) {
                flaggedShipments.push({
                    id: shipment.id,
                    tracking_number: shipment.tracking_number,
                    previous_status: shipment.status,
                    new_status: SHIPMENT_STATUS.DELAYED,
                    delay_reason: delayReason,
                    dry_run: true
                });
                continue;
            }

            // Execute status update and event creation in a transaction
            try {
                await client.query("BEGIN");

                // Update shipment status
                await client.query(
                    `
                    UPDATE shipments
                    SET status = 'DELAYED',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    `,
                    [shipment.id]
                );

                // Record delay event in shipment_events
                const eventResult = await client.query(
                    `
                    INSERT INTO shipment_events (
                        shipment_id,
                        status,
                        location,
                        description,
                        event_time
                    )
                    VALUES ($1, 'DELAYED', $2, $3, CURRENT_TIMESTAMP)
                    RETURNING *
                    `,
                    [
                        shipment.id,
                        shipment.last_location || shipment.origin,
                        `Automated Delay Detection: ${delayReason}`
                    ]
                );

                await client.query("COMMIT");

                // Trigger existing notification pipeline
                let notificationResult = null;
                try {
                    notificationResult = await processShipmentEvent({
                        shipmentId: shipment.id,
                        status: SHIPMENT_STATUS.DELAYED,
                        priority: shipment.priority
                    });
                } catch (notifError) {
                    console.error(
                        `[DelayDetection] Notification trigger failed for shipment ${shipment.id}:`,
                        notifError.message
                    );
                }

                flaggedShipments.push({
                    id: shipment.id,
                    tracking_number: shipment.tracking_number,
                    previous_status: shipment.status,
                    new_status: SHIPMENT_STATUS.DELAYED,
                    delay_reason: delayReason,
                    event_id: eventResult.rows[0]?.id,
                    notification: notificationResult
                });

                console.log(
                    `[DelayDetection] Shipment ${shipment.id} (${shipment.tracking_number}) transitioned from ${shipment.status} to DELAYED`
                );
            } catch (txError) {
                await client.query("ROLLBACK");
                console.error(
                    `[DelayDetection] Error updating shipment ${shipment.id} to DELAYED:`,
                    txError.message
                );
            }
        }

        return {
            timestamp: new Date().toISOString(),
            total_scanned: candidates.length,
            delayed_count: flaggedShipments.length,
            flagged_shipments: flaggedShipments
        };
    } finally {
        client.release();
    }
};

module.exports = {
    checkAndFlagDelayedShipments,
    INACTIVITY_THRESHOLD_HOURS
};
