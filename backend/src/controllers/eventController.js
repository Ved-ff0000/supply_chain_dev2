
const pool = require("../config/database");


// ======================================================
// NOTIFICATION ENGINE
// ======================================================

const {
    processShipmentEvent
} = require("../services/notificationEngine");


// ======================================================
// GET EVENTS FOR SHIPMENT
// ======================================================
//
// GET /api/events/shipment/:shipmentId
//
// ======================================================

const getShipmentEvents = async (req, res) => {

    try {

        const { shipmentId } =
            req.params;


        // ==================================================
        // CHECK SHIPMENT
        // ==================================================

        const shipmentResult =
            await pool.query(
                `
                SELECT
                    id,
                    tracking_number,
                    status
                FROM shipments
                WHERE id = $1
                `,
                [shipmentId]
            );


        if (
            shipmentResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Shipment not found"

            });

        }


        // ==================================================
        // GET EVENTS
        // ==================================================

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    shipment_id,
                    status,
                    location,
                    description,
                    event_time,
                    created_at
                FROM shipment_events
                WHERE shipment_id = $1
                ORDER BY event_time ASC
                `,
                [shipmentId]
            );


        return res.status(200).json({

            success: true,

            shipment:
                shipmentResult.rows[0],

            count:
                result.rows.length,

            events:
                result.rows

        });


    } catch (error) {

        console.error(
            "Error fetching shipment events:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch shipment events",

            error:
                error.message

        });

    }

};


// ======================================================
// GET LATEST EVENT
// ======================================================
//
// GET /api/events/shipment/:shipmentId/latest
//
// ======================================================

const getLatestShipmentEvent =
    async (req, res) => {

        try {

            const { shipmentId } =
                req.params;


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        shipment_id,
                        status,
                        location,
                        description,
                        event_time,
                        created_at
                    FROM shipment_events
                    WHERE shipment_id = $1
                    ORDER BY event_time DESC
                    LIMIT 1
                    `,
                    [shipmentId]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "No events found for this shipment"

                });

            }


            return res.status(200).json({

                success: true,

                data:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "Error fetching latest event:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch latest shipment event",

                error:
                    error.message

            });

        }

    };


// ======================================================
// CREATE SHIPMENT EVENT
// ======================================================
//
// POST /api/events/shipment/:shipmentId
//
// Body:
//
// {
//     "status": "IN_TRANSIT",
//     "location": "Hyderabad",
//     "description": "Shipment departed facility"
// }
//
// ======================================================

const createShipmentEvent =
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const { shipmentId } =
                req.params;


            const {
                status,
                location,
                description,
                event_time
            } = req.body;


            // ==================================================
            // VALIDATION
            // ==================================================

            if (!status) {

                return res.status(400).json({

                    success: false,

                    message:
                        "status is required"

                });

            }


            const normalizedStatus =
                String(status)
                    .trim()
                    .toUpperCase();


            if (!normalizedStatus) {

                return res.status(400).json({

                    success: false,

                    message:
                        "status cannot be empty"

                });

            }


            // ==================================================
            // CHECK SHIPMENT
            // ==================================================

            const shipmentResult =
                await client.query(
                    `
                    SELECT
                        id,
                        tracking_number,
                        customer_id,
                        status,
                        actual_delivery
                    FROM shipments
                    WHERE id = $1
                    `,
                    [shipmentId]
                );


            if (
                shipmentResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Shipment not found"

                });

            }


            const shipment =
                shipmentResult.rows[0];


            // ==================================================
            // BEGIN TRANSACTION
            // ==================================================

            await client.query(
                "BEGIN"
            );


            // ==================================================
            // UPDATE SHIPMENT STATUS
            // ==================================================

            let actualDelivery =
                shipment.actual_delivery;


            if (
                normalizedStatus === "DELIVERED"
            ) {

                actualDelivery =
                    new Date();

            }


            const updatedShipmentResult =
                await client.query(
                    `
                    UPDATE shipments

                    SET
                        status = $1,

                        actual_delivery = $2,

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $3

                    RETURNING
                        id,
                        tracking_number,
                        customer_id,
                        status,
                        actual_delivery,
                        updated_at
                    `,
                    [

                        normalizedStatus,

                        actualDelivery,

                        shipmentId

                    ]
                );


            // ==================================================
            // CREATE EVENT
            // ==================================================

            const eventResult =
                await client.query(
                    `
                    INSERT INTO shipment_events (

                        shipment_id,

                        status,

                        location,

                        description,

                        event_time

                    )

                    VALUES (

                        $1,

                        $2,

                        $3,

                        $4,

                        $5

                    )

                    RETURNING
                        id,
                        shipment_id,
                        status,
                        location,
                        description,
                        event_time,
                        created_at
                    `,
                    [

                        shipmentId,

                        normalizedStatus,

                        location || null,

                        description ||
                            `Shipment status changed to ${normalizedStatus}`,

                        event_time ||
                            new Date()

                    ]
                );


            // ==================================================
            // COMMIT TRANSACTION
            // ==================================================

            await client.query(
                "COMMIT"
            );


            // ==================================================
            // PROCESS NOTIFICATION
            // ==================================================

            let notificationResult =
                null;


            try {

                notificationResult =
                    await processShipmentEvent({

                        shipmentId,

                        status:
                            normalizedStatus

                    });

            } catch (notificationError) {

                console.error(
                    "Notification engine failed:",
                    notificationError
                );


                notificationResult = {

                    created: false,

                    reason:
                        "Notification processing failed",

                    error:
                        notificationError.message

                };

            }


            // ==================================================
            // SUCCESS RESPONSE
            // ==================================================

            return res.status(201).json({

                success: true,

                message:
                    "Shipment event created successfully",

                shipment:
                    updatedShipmentResult.rows[0],

                event:
                    eventResult.rows[0],

                notification:
                    notificationResult

            });


        } catch (error) {

            // ==================================================
            // ROLLBACK
            // ==================================================

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Rollback error:",
                    rollbackError
                );

            }


            console.error(
                "Error creating shipment event:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to create shipment event",

                error:
                    error.message

            });

        } finally {

            client.release();

        }

    };


// ======================================================
// DELETE EVENT
// ======================================================
//
// DELETE /api/events/:eventId
//
// ======================================================

const deleteShipmentEvent =
    async (req, res) => {

        try {

            const { eventId } =
                req.params;


            const result =
                await pool.query(
                    `
                    DELETE FROM shipment_events

                    WHERE id = $1

                    RETURNING
                        id,
                        shipment_id,
                        status,
                        location,
                        description,
                        event_time,
                        created_at
                    `,
                    [eventId]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Shipment event not found"

                });

            }


            return res.status(200).json({

                success: true,

                message:
                    "Shipment event deleted successfully",

                data:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "Error deleting shipment event:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to delete shipment event",

                error:
                    error.message

            });

        }

    };


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    getShipmentEvents,

    getLatestShipmentEvent,

    createShipmentEvent,

    deleteShipmentEvent

};

