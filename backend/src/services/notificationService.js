
const pool = require("../config/database");
const { sendShipmentNotificationEmail } = require("./emailService");
const { sendWebhookNotification } = require("./webhookService");


// ======================================================
// CREATE SHIPMENT NOTIFICATION
// ======================================================

const createShipmentNotification = async ({
    shipmentId,
    status,
    title,
    message,
    priority = "NORMAL"
}) => {

    try {

        const normalizedStatus =
            String(status)
                .trim()
                .toUpperCase();

        const normalizedPriority =
            String(priority)
                .trim()
                .toUpperCase();

        const normalizedShipmentId =
            Number(shipmentId);


        // ==================================================
        // FIND SHIPMENT + CUSTOMER
        // ==================================================

        const shipmentResult =
            await pool.query(
                `
                SELECT

                    s.id AS shipment_id,

                    s.tracking_number,

                    s.priority AS shipment_priority,

                    c.id AS customer_id,

                    c.name AS customer_name,

                    c.email AS customer_email

                FROM shipments s

                JOIN customers c
                    ON s.customer_id = c.id

                WHERE s.id = $1
                `,
                [normalizedShipmentId]
            );


        if (
            shipmentResult.rows.length === 0
        ) {

            throw new Error(
                "Shipment not found"
            );
        }


        const shipment =
            shipmentResult.rows[0];


        // ==================================================
        // GET CUSTOMER PREFERENCES
        // ==================================================

        const preferenceResult =
            await pool.query(
                `
                SELECT

                    email_enabled,

                    in_app_enabled,

                    webhook_enabled,

                    webhook_url,

                    webhook_secret,

                    notify_in_transit,

                    notify_customs_hold,

                    notify_delayed,

                    notify_out_for_delivery,

                    notify_delivered

                FROM notification_preferences

                WHERE customer_id = $1
                `,
                [shipment.customer_id]
            );


        // ==================================================
        // DEFAULT PREFERENCES
        // ==================================================

        let preferences = {

            email_enabled: true,

            in_app_enabled: true,

            webhook_enabled: false,

            webhook_url: null,

            webhook_secret: null,

            notify_in_transit: true,

            notify_customs_hold: true,

            notify_delayed: true,

            notify_out_for_delivery: true,

            notify_delivered: true

        };


        if (
            preferenceResult.rows.length > 0
        ) {

            preferences =
                preferenceResult.rows[0];
        }


        // ==================================================
        // STATUS PREFERENCE
        // ==================================================

        const statusPreferenceMap = {

            IN_TRANSIT:
                preferences.notify_in_transit,

            CUSTOMS_HOLD:
                preferences.notify_customs_hold,

            DELAYED:
                preferences.notify_delayed,

            OUT_FOR_DELIVERY:
                preferences.notify_out_for_delivery,

            DELIVERED:
                preferences.notify_delivered

        };


        const statusEnabled =
            statusPreferenceMap[
                normalizedStatus
            ];


        // ==================================================
        // NOTIFICATION DISABLED
        // ==================================================

        if (
            statusEnabled === false
        ) {

            return {

                created: false,

                reason:
                    "Notification disabled by customer preference"

            };
        }


        // ==================================================
        // IN-APP NOTIFICATION
        // ==================================================

        if (
            preferences.in_app_enabled
        ) {

            const notificationResult =
                await pool.query(
                    `
                    INSERT INTO notifications (

                        shipment_id,

                        customer_id,

                        type,

                        title,

                        message,

                        channel,

                        status,

                        priority

                    )

                    VALUES (

                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        'IN_APP',
                        'UNREAD',
                        $6

                    )

                    RETURNING *
                    `,
                    [
                        shipment.shipment_id,
                        shipment.customer_id,
                        normalizedStatus,
                        title,
                        message,
                        normalizedPriority
                    ]
                );


            const createdNotification =
                notificationResult.rows[0];

            // ==================================================
            // REAL EMAIL DELIVERY (IF ENABLED)
            // ==================================================

            if (preferences.email_enabled && shipment.customer_email) {
                // Fire and forget (non-blocking)
                sendShipmentNotificationEmail({
                    to: shipment.customer_email,
                    customerName: shipment.customer_name,
                    trackingNumber: shipment.tracking_number,
                    status: normalizedStatus,
                    title,
                    message,
                    priority: normalizedPriority
                }).catch(emailErr => {
                    console.error("[NotificationService] Async email dispatch error:", emailErr.message);
                });
            }

            // ==================================================
            // REAL WEBHOOK DELIVERY (IF ENABLED & URL REGISTERED)
            // ==================================================

            if (preferences.webhook_enabled && preferences.webhook_url) {
                // Fire and forget with retry & logging (non-blocking)
                sendWebhookNotification({
                    webhookUrl: preferences.webhook_url,
                    webhookSecret: preferences.webhook_secret,
                    notification: createdNotification,
                    customerId: shipment.customer_id,
                    maxAttempts: 3
                }).catch(webhookErr => {
                    console.error("[NotificationService] Async webhook dispatch error:", webhookErr.message);
                });
            }

            return {

                created: true,

                channel:
                    "IN_APP",

                notification:
                    createdNotification,

                delivery: {
                    email_dispatched: Boolean(preferences.email_enabled && shipment.customer_email),
                    webhook_dispatched: Boolean(preferences.webhook_enabled && preferences.webhook_url)
                }

            };
        }


        // ==================================================
        // IN-APP DISABLED
        // ==================================================

        return {

            created: false,

            reason:
                "In-app notifications are disabled"

        };

    } catch (error) {

        console.error(
            "Notification service error:",
            error
        );

        throw error;
    }
};


// ======================================================
// GENERATE NOTIFICATION MESSAGE
// ======================================================

const generateShipmentNotification = (
    shipment,
    newStatus
) => {

    const status =
        String(newStatus)
            .trim()
            .toUpperCase();


    const trackingNumber =
        shipment.tracking_number;


    switch (status) {

        case "IN_TRANSIT":

            return {

                title:
                    "Shipment In Transit",

                message:
                    `Your shipment ${trackingNumber} is currently in transit.`,

                priority:
                    shipment.priority || "NORMAL"

            };


        case "CUSTOMS_HOLD":

            return {

                title:
                    "Customs Hold",

                message:
                    `Your shipment ${trackingNumber} is currently being held by customs.`,

                priority:
                    "URGENT"

            };


        case "DELAYED":

            return {

                title:
                    "Shipment Delayed",

                message:
                    `Your shipment ${trackingNumber} has been delayed.`,

                priority:
                    "HIGH"

            };


        case "OUT_FOR_DELIVERY":

            return {

                title:
                    "Out for Delivery",

                message:
                    `Your shipment ${trackingNumber} is out for delivery.`,

                priority:
                    "HIGH"

            };


        case "DELIVERED":

            return {

                title:
                    "Shipment Delivered",

                message:
                    `Your shipment ${trackingNumber} has been successfully delivered.`,

                priority:
                    "NORMAL"

            };


        default:

            return {

                title:
                    `Shipment Status: ${status}`,

                message:
                    `Your shipment ${trackingNumber} status has changed to ${status}.`,

                priority:
                    shipment.priority || "NORMAL"

            };
    }
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    createShipmentNotification,

    generateShipmentNotification

};

