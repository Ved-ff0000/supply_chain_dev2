
const pool = require("../config/database");


// ======================================================
// NOTIFICATION ENGINE
// ======================================================

const {
    processShipmentEvent
} = require("../services/notificationEngine");


// ======================================================
// CREATE SHIPMENT
// ======================================================
//
// POST /api/shipments
//
// ======================================================

const createShipment = async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            tracking_number,
            carrier_id,
            customer_id,
            origin,
            destination,
            status,
            priority,
            expected_delivery
        } = req.body;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (!tracking_number) {

            return res.status(400).json({

                success: false,

                message:
                    "tracking_number is required"

            });

        }


        if (!carrier_id) {

            return res.status(400).json({

                success: false,

                message:
                    "carrier_id is required"

            });

        }


        if (!customer_id) {

            return res.status(400).json({

                success: false,

                message:
                    "customer_id is required"

            });

        }


        if (!origin) {

            return res.status(400).json({

                success: false,

                message:
                    "origin is required"

            });

        }


        if (!destination) {

            return res.status(400).json({

                success: false,

                message:
                    "destination is required"

            });

        }


        // ==================================================
        // NORMALIZE STATUS
        // ==================================================

        const normalizedStatus =
            status
                ? String(status)
                    .trim()
                    .toUpperCase()
                : "PENDING";


        const normalizedPriority =
            priority
                ? String(priority)
                    .trim()
                    .toUpperCase()
                : "NORMAL";


        // ==================================================
        // BEGIN TRANSACTION
        // ==================================================

        await client.query("BEGIN");


        // ==================================================
        // CREATE SHIPMENT
        // ==================================================

        const result =
            await client.query(
                `
                INSERT INTO shipments (

                    tracking_number,

                    carrier_id,

                    customer_id,

                    origin,

                    destination,

                    status,

                    priority,

                    expected_delivery

                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )

                RETURNING *
                `,
                [

                    tracking_number,

                    carrier_id,

                    customer_id,

                    origin,

                    destination,

                    normalizedStatus,

                    normalizedPriority,

                    expected_delivery || null

                ]
            );


        // ==================================================
        // CREATE INITIAL SHIPMENT EVENT
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
                    CURRENT_TIMESTAMP
                )

                RETURNING *
                `,
                [

                    result.rows[0].id,

                    normalizedStatus,

                    origin,

                    "Shipment created"

                ]
            );


        // ==================================================
        // COMMIT
        // ==================================================

        await client.query("COMMIT");


        // ==================================================
        // PROCESS INITIAL NOTIFICATION
        // ==================================================

        let notification = null;


        try {

            const notificationResult =
                await processShipmentEvent({

                    shipmentId:
                        result.rows[0].id,

                    status:
                        normalizedStatus

                });


            notification =
                notificationResult;


        } catch (notificationError) {

            console.error(
                "Initial notification creation failed:",
                notificationError
            );


            notification = {

                created: false,

                reason:
                    "Notification processing failed",

                error:
                    notificationError.message

            };

        }


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            message:
                "Shipment created successfully",

            data:
                result.rows[0],

            event:
                eventResult.rows[0],

            notification

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


        // ==================================================
        // ERROR
        // ==================================================

        console.error(
            "Error creating shipment:",
            error
        );


        // Duplicate tracking number

        if (
            error.code === "23505"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Tracking number already exists"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Failed to create shipment",

            error:
                error.message

        });

    } finally {

        client.release();

    }

};


// ======================================================
// GET ALL SHIPMENTS
// ======================================================
//
// GET /api/shipments
//
// ======================================================

const getAllShipments = async (req, res) => {

    try {

        const result =
            await pool.query(
                `
                SELECT

                    s.id,

                    s.tracking_number,

                    c.name AS customer,

                    c.email AS customer_email,

                    ca.name AS carrier,

                    ca.code AS carrier_code,

                    s.origin,

                    s.destination,

                    s.status,

                    s.priority,

                    s.expected_delivery,

                    s.actual_delivery,

                    s.created_at,

                    s.updated_at

                FROM shipments s

                JOIN customers c
                    ON s.customer_id = c.id

                JOIN carriers ca
                    ON s.carrier_id = ca.id

                ORDER BY
                    s.created_at DESC
                `
            );


        return res.status(200).json({

            success: true,

            count:
                result.rows.length,

            data:
                result.rows

        });


    } catch (error) {

        console.error(
            "Error fetching shipments:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch shipments",

            error:
                error.message

        });

    }

};


// ======================================================
// GET SHIPMENT BY ID
// ======================================================
//
// GET /api/shipments/:id
//
// ======================================================

const getShipmentById = async (req, res) => {

    try {

        const { id } =
            req.params;


        const result =
            await pool.query(
                `
                SELECT

                    s.id,

                    s.tracking_number,

                    s.carrier_id,

                    s.customer_id,

                    c.name AS customer,

                    c.email AS customer_email,

                    ca.name AS carrier,

                    ca.code AS carrier_code,

                    s.origin,

                    s.destination,

                    s.status,

                    s.priority,

                    s.expected_delivery,

                    s.actual_delivery,

                    s.created_at,

                    s.updated_at

                FROM shipments s

                JOIN customers c
                    ON s.customer_id = c.id

                JOIN carriers ca
                    ON s.carrier_id = ca.id

                WHERE s.id = $1
                `,
                [id]
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Shipment not found"

            });

        }


        return res.status(200).json({

            success: true,

            data:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "Error fetching shipment:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch shipment",

            error:
                error.message

        });

    }

};


// ======================================================
// UPDATE SHIPMENT
// ======================================================
//
// PATCH /api/shipments/:id
//
// ======================================================

const updateShipment = async (req, res) => {

    try {

        const { id } =
            req.params;


        const {
            carrier_id,
            customer_id,
            origin,
            destination,
            priority,
            expected_delivery
        } = req.body;


        // ==================================================
        // FIND CURRENT SHIPMENT
        // ==================================================

        const currentResult =
            await pool.query(
                `
                SELECT *

                FROM shipments

                WHERE id = $1
                `,
                [id]
            );


        if (
            currentResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Shipment not found"

            });

        }


        const current =
            currentResult.rows[0];


        // ==================================================
        // UPDATE
        // ==================================================

        const result =
            await pool.query(
                `
                UPDATE shipments

                SET

                    carrier_id =
                        $1,

                    customer_id =
                        $2,

                    origin =
                        $3,

                    destination =
                        $4,

                    priority =
                        $5,

                    expected_delivery =
                        $6,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $7

                RETURNING *
                `,
                [

                    carrier_id ??
                        current.carrier_id,

                    customer_id ??
                        current.customer_id,

                    origin ??
                        current.origin,

                    destination ??
                        current.destination,

                    priority ??
                        current.priority,

                    expected_delivery ??
                        current.expected_delivery,

                    id

                ]
            );


        return res.status(200).json({

            success: true,

            message:
                "Shipment updated successfully",

            data:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "Error updating shipment:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to update shipment",

            error:
                error.message

        });

    }

};


// ======================================================
// UPDATE SHIPMENT STATUS
// ======================================================
//
// PATCH /api/shipments/:id/status
//
// ======================================================

const updateShipmentStatus = async (req, res) => {

    const client =
        await pool.connect();


    try {

        const { id } =
            req.params;


        const {
            status,
            location,
            description
        } = req.body;


        // ==================================================
        // VALIDATE
        // ==================================================

        if (!status) {

            return res.status(400).json({

                success: false,

                message:
                    "status is required"

            });

        }


        // ==================================================
        // NORMALIZE
        // ==================================================

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
        // FIND SHIPMENT
        // ==================================================

        const shipmentResult =
            await client.query(
                `
                SELECT

                    id,

                    tracking_number,

                    carrier_id,

                    customer_id,

                    origin,

                    destination,

                    status,

                    priority,

                    expected_delivery,

                    actual_delivery

                FROM shipments

                WHERE id = $1
                `,
                [id]
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


        const currentShipment =
            shipmentResult.rows[0];


        // ==================================================
        // BEGIN TRANSACTION
        // ==================================================

        await client.query("BEGIN");


        // ==================================================
        // ACTUAL DELIVERY
        // ==================================================

        let actualDelivery =
            currentShipment.actual_delivery;


        if (
            normalizedStatus === "DELIVERED"
        ) {

            actualDelivery =
                new Date();

        }


        // ==================================================
        // UPDATE SHIPMENT
        // ==================================================

        const updatedShipmentResult =
            await client.query(
                `
                UPDATE shipments

                SET

                    status =
                        $1,

                    actual_delivery =
                        $2,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $3

                RETURNING *
                `,
                [

                    normalizedStatus,

                    actualDelivery,

                    id

                ]
            );


        // ==================================================
        // CREATE SHIPMENT EVENT
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

                    CURRENT_TIMESTAMP

                )

                RETURNING *
                `,
                [

                    id,

                    normalizedStatus,

                    location || null,

                    description ||
                        `Shipment status changed to ${normalizedStatus}`

                ]
            );


        // ==================================================
        // COMMIT
        // ==================================================

        await client.query(
            "COMMIT"
        );


        // ==================================================
        // NOTIFICATION ENGINE
        // ==================================================

        let notificationResult =
            null;


        try {

            notificationResult =
                await processShipmentEvent({

                    shipmentId:
                        id,

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
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                "Shipment status updated successfully",

            data:
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
            "Error updating shipment status:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to update shipment status",

            error:
                error.message

        });


    } finally {

        client.release();

    }

};


// ======================================================
// DELETE SHIPMENT
// ======================================================
//
// DELETE /api/shipments/:id
//
// ======================================================

const deleteShipment = async (req, res) => {

    try {

        const { id } =
            req.params;


        const result =
            await pool.query(
                `
                DELETE FROM shipments

                WHERE id = $1

                RETURNING *
                `,
                [id]
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Shipment not found"

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Shipment deleted successfully",

            data:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "Error deleting shipment:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to delete shipment",

            error:
                error.message

        });

    }

};


// ======================================================
// TRACK BY TRACKING NUMBER
// ======================================================
//
// GET /api/shipments/tracking/:trackingNumber
//
// ======================================================

const getShipmentByTrackingNumber =
    async (req, res) => {

        try {

            const {
                trackingNumber
            } = req.params;


            const result =
                await pool.query(
                    `
                    SELECT

                        s.id,

                        s.tracking_number,

                        c.name AS customer,

                        c.email AS customer_email,

                        ca.name AS carrier,

                        ca.code AS carrier_code,

                        s.origin,

                        s.destination,

                        s.status,

                        s.priority,

                        s.expected_delivery,

                        s.actual_delivery,

                        s.created_at,

                        s.updated_at

                    FROM shipments s

                    JOIN customers c
                        ON s.customer_id = c.id

                    JOIN carriers ca
                        ON s.carrier_id = ca.id

                    WHERE
                        s.tracking_number = $1
                    `,
                    [trackingNumber]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Shipment not found"

                });

            }


            return res.status(200).json({

                success: true,

                data:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "Error tracking shipment:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to track shipment",

                error:
                    error.message

            });

        }

    };


// ======================================================
// GET SHIPMENT EVENTS
// ======================================================
//
// GET /api/shipments/:id/events
//
// ======================================================

const getShipmentEvents =
    async (req, res) => {

        try {

            const { id } =
                req.params;


            // ==================================================
            // CHECK SHIPMENT
            // ==================================================

            const shipment =
                await pool.query(
                    `
                    SELECT

                        id,

                        tracking_number,

                        status

                    FROM shipments

                    WHERE id = $1
                    `,
                    [id]
                );


            if (
                shipment.rows.length === 0
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

                    ORDER BY
                        event_time ASC
                    `,
                    [id]
                );


            return res.status(200).json({

                success: true,

                shipment:
                    shipment.rows[0],

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
// CREATE SHIPMENT EVENT
// ======================================================
//
// POST /api/shipments/:id/events
//
// ======================================================

const createShipmentEvent =
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const { id } =
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


            // ==================================================
            // CHECK SHIPMENT
            // ==================================================

            const shipmentResult =
                await client.query(
                    `
                    SELECT *

                    FROM shipments

                    WHERE id = $1
                    `,
                    [id]
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
            // BEGIN TRANSACTION
            // ==================================================

            await client.query(
                "BEGIN"
            );


            // ==================================================
            // UPDATE SHIPMENT STATUS
            // ==================================================

            let actualDelivery =
                shipmentResult.rows[0]
                    .actual_delivery;


            if (
                normalizedStatus ===
                "DELIVERED"
            ) {

                actualDelivery =
                    new Date();

            }


            const updatedShipment =
                await client.query(
                    `
                    UPDATE shipments

                    SET

                        status =
                            $1,

                        actual_delivery =
                            $2,

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $3

                    RETURNING *
                    `,
                    [

                        normalizedStatus,

                        actualDelivery,

                        id

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

                    RETURNING *
                    `,
                    [

                        id,

                        normalizedStatus,

                        location || null,

                        description || null,

                        event_time
                            || new Date()

                    ]
                );


            // ==================================================
            // COMMIT
            // ==================================================

            await client.query(
                "COMMIT"
            );


            // ==================================================
            // NOTIFICATION ENGINE
            // ==================================================

            let notificationResult =
                null;


            try {

                notificationResult =
                    await processShipmentEvent({

                        shipmentId:
                            id,

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
            // RESPONSE
            // ==================================================

            return res.status(201).json({

                success: true,

                message:
                    "Shipment event created successfully",

                shipment:
                    updatedShipment.rows[0],

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
// EXPORTS
// ======================================================

module.exports = {

    createShipment,

    getAllShipments,

    getShipmentById,

    updateShipment,

    updateShipmentStatus,

    deleteShipment,

    getShipmentByTrackingNumber,

    getShipmentEvents,

    createShipmentEvent

};

