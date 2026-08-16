const {
    createShipmentNotification,
    generateShipmentNotification
} = require("./notificationService");
const pool = require("../config/database");

/**
 * Process a shipment status change into an in-app notification.
 * Used by event and status-update flows after the shipment is updated.
 */
const processShipmentEvent = async ({
    shipmentId,
    status,
    priority
}) => {
    const normalizedShipmentId = Number(shipmentId);
    const normalizedStatus = String(status).trim().toUpperCase();

    if (!normalizedShipmentId || !normalizedStatus) {
        return {
            created: false,
            reason: "shipmentId and status are required"
        };
    }

    const shipmentResult = await pool.query(
        `
        SELECT
            id,
            tracking_number,
            customer_id,
            status,
            priority
        FROM shipments
        WHERE id = $1
        `,
        [normalizedShipmentId]
    );

    if (shipmentResult.rows.length === 0) {
        return {
            created: false,
            reason: "Shipment not found"
        };
    }

    const shipment = shipmentResult.rows[0];
    const notificationData = generateShipmentNotification(
        {
            ...shipment,
            priority: priority || shipment.priority
        },
        normalizedStatus
    );

    return createShipmentNotification({
        shipmentId: shipment.id,
        status: normalizedStatus,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority
    });
};

module.exports = {
    processShipmentEvent
};
