const pool = require("../config/database");

const {
    createShipmentNotification,
    generateShipmentNotification
} = require("../services/notificationService");


// ======================================================
// GET ALL SHIPMENTS
// ======================================================
//
// GET /api/shipments
//
// Query parameters:
//
// ?status=IN_TRANSIT
// ?priority=HIGH
// ?carrier_id=1
// ?customer_id=1
// ?search=FDX100001
//
// ======================================================

const getAllShipments = async (req, res) => {

    try {

        const {
            status,
            priority,
            carrier_id,
            customer_id,
            search
        } = req.query;

        const conditions = [];
        const values = [];


        // ==================================================
        // STATUS FILTER
        // ==================================================

        if (status) {

            values.push(
                status.trim().toUpperCase()
            );

            conditions.push(
                `s.status = $${values.length}`
            );

        }


        // ==================================================
        // PRIORITY FILTER
        // ==================================================

        if (priority) {

            values.push(
                priority.trim().toUpperCase()
            );

            conditions.push(
                `s.priority = $${values.length}`
            );

        }


        // ==================================================
        // CARRIER FILTER
        // ==================================================

        if (carrier_id) {

            values.push(carrier_id);

            conditions.push(
                `s.carrier_id = $${values.length}`
            );

        }


        // ==================================================
        // CUSTOMER FILTER
        // ==================================================

        if (customer_id) {

            values.push(customer_id);

            conditions.push(
                `s.customer_id = $${values.length}`
            );

        }


        // ==================================================
        // SEARCH
        // ==================================================

        if (search) {

            values.push(
                `%${search.trim()}%`
            );

            const index = values.length;

            conditions.push(`
                (
                    s.tracking_number ILIKE $${index}
                    OR c.name ILIKE $${index}
                    OR c.email ILIKE $${index}
                    OR ca.name ILIKE $${index}
                )
            `);

        }


        // ==================================================
        // WHERE CLAUSE
        // ==================================================

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";


        // ==================================================
        // QUERY
        // ==================================================

        const result = await pool.query(
            `
            SELECT

                s.id,

                s.tracking_number,

                c.id AS customer_id,
                c.name AS customer,
                c.email AS customer_email,
                c.phone AS customer_phone,

                ca.id AS carrier_id,
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

            ${whereClause}

            ORDER BY s.id ASC
            `,
            values
        );


        return res.status(200).json({

            success: true,

            count: result.rows.length,

            data: result.rows

        });

    } catch (error) {

        console.error(
            "Error fetching shipments:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Failed to fetch shipments",

            error: error.message

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

        const { id } = req.params;


        const result = await pool.query(
            `
            SELECT

                s.id,

                s.tracking_number,

                c.id AS customer_id,
                c.name AS customer,
                c.email AS customer_email,
                c.phone AS customer_phone,
                c.company_name,

                ca.id AS carrier_id,
                ca.name AS carrier,
                ca.code AS carrier_code,
                ca.api_enabled,

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


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Shipment not found"

            });

        }


        return res.status(200).json({

            success: true,

            data: result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error fetching shipment:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Failed to fetch shipment",

            error: error.message

        });

    }

};


// ======================================================
// GET SHIPMENT BY TRACKING NUMBER
// ======================================================
//
// GET /api/shipments/tracking/:trackingNumber
//
// ======================================================

const getShipmentByTrackingNumber = async (
    req,
    res
) => {

    try {

        const {
            trackingNumber
        } = req.params;


        const result = await pool.query(
            `
            SELECT

                s.id,

                s.tracking_number,

                c.id AS customer_id,
                c.name AS customer,
                c.email AS customer_email,
                c.phone AS customer_phone,

                ca.id AS carrier_id,
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

            WHERE s.tracking_number = $1
            `,
            [trackingNumber]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Shipment not found"

            });

        }


        return res.status(200).json({

            success: true,

            data: result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error fetching shipment by tracking number:",
            error
        );

        return res.status(500).json({

            success: false,

            message: "Failed to fetch shipment",

            error: error.message

        });

    }

};


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

        if (
            !tracking_number ||
            !carrier_id ||
            !customer_id ||
            !origin ||
            !destination
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "tracking_number, carrier_id, customer_id, origin and destination are required"

            });

        }


        const normalizedStatus =
            status
                ? status.trim().toUpperCase()
                : "IN_TRANSIT";


        const normalizedPriority =
            priority
                ? priority.trim().toUpperCase()
                : "NORMAL";


        // ==================================================
        // CHECK CARRIER
        // ==================================================

        const carrierResult =
            await client.query(
                `
                SELECT id
                FROM carriers
                WHERE id = $1
                `,
                [carrier_id]
            );


        if (carrierResult.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Carrier not found"

            });

        }


        // ==================================================
        // CHECK CUSTOMER
        // ==================================================

        const customerResult =
            await client.query(
                `
                SELECT id
                FROM customers
                WHERE id = $1
                `,
                [customer_id]
            );


        if (customerResult.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Customer not found"

            });

        }


        // ==================================================
        // START TRANSACTION
        // ==================================================

        await client.query("BEGIN");


        // ==================================================
        // INSERT SHIPMENT
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

                RETURNING

                    id,
                    tracking_number,
                    carrier_id,
                    customer_id,
                    origin,
                    destination,
                    status,
                    priority,
                    expected_delivery,
                    actual_delivery,
                    created_at,
                    updated_at
                `,
                [
                    tracking_number.trim(),
                    carrier_id,
                    customer_id,
                    origin.trim(),
                    destination.trim(),
                    normalizedStatus,
                    normalizedPriority,
                    expected_delivery || null
                ]
            );


        // ==================================================
        // COMMIT
        // ==================================================

        await client.query("COMMIT");


        // ==================================================
        // CREATE INITIAL NOTIFICATION
        // ==================================================

        let notification = null;


        try {

            const shipment =
                result.rows[0];


            const notificationData =
                generateShipmentNotification(
                    shipment,
                    normalizedStatus
                );


            const notificationResult =
                await createShipmentNotification({

                    shipmentId:
                        shipment.id,

                    status:
                        normalizedStatus,

                    title:
                        notificationData.title,

                    message:
                        notificationData.message,

                    priority:
                        notificationData.priority

                });


            if (
                notificationResult.created
            ) {

                notification =
                    notificationResult.notification;

            }

        } catch (notificationError) {

            console.error(
                "Initial notification creation failed:",
                notificationError
            );

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

            notification

        });

    } catch (error) {

        // ==================================================
        // ROLLBACK
        // ==================================================

        try {

            await client.query("ROLLBACK");

        } catch (rollbackError) {

            console.error(
                "Rollback error:",
                rollbackError
            );

        }


        console.error(
            "Error creating shipment:",
            error
        );


        // ==================================================
        // DUPLICATE TRACKING NUMBER
        // ==================================================

        if (error.code === "23505") {

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
// UPDATE SHIPMENT STATUS
// ======================================================
//
// PATCH /api/shipments/:id/status
//
// Body:
//
// {
//     "status": "OUT_FOR_DELIVERY"
// }
//
// ======================================================

const updateShipmentStatus = async (
    req,
    res
) => {

    try {

        const { id } = req.params;


        // ==================================================
        // SAFELY READ BODY
        // ==================================================

        const body = req.body || {};

        const {
            status
        } = body;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (
            !status ||
            typeof status !== "string"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Status is required"

            });

        }


        const normalizedStatus =
            status
                .trim()
                .toUpperCase();


        if (!normalizedStatus) {

            return res.status(400).json({

                success: false,

                message:
                    "Status cannot be empty"

            });

        }


        // ==================================================
        // GET CURRENT SHIPMENT
        // ==================================================

        const currentResult =
            await pool.query(
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


        const currentShipment =
            currentResult.rows[0];


        // ==================================================
        // CHECK IF STATUS IS SAME
        // ==================================================

        if (
            currentShipment.status ===
            normalizedStatus
        ) {

            return res.status(200).json({

                success: true,

                message:
                    "Shipment already has this status",

                data:
                    currentShipment,

                notification:
                    null

            });

        }


        // ==================================================
        // UPDATE SHIPMENT
        // ==================================================
        //
        // IMPORTANT:
        // $1::text prevents PostgreSQL from trying to
        // infer different types for the same parameter.
        //
        // ==================================================

        const result =
            await pool.query(
                `
                UPDATE shipments

                SET

                    status = $1,

                    actual_delivery =
                        CASE
                            WHEN $1::text = 'DELIVERED'
                            THEN CURRENT_TIMESTAMP

                            ELSE actual_delivery
                        END,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $2

                RETURNING

                    id,
                    tracking_number,
                    customer_id,
                    status,
                    priority,
                    expected_delivery,
                    actual_delivery,
                    updated_at
                `,
                [
                    normalizedStatus,
                    id
                ]
            );


        // ==================================================
        // GENERATE NOTIFICATION
        // ==================================================

        let notification = null;


        try {

            const updatedShipment =
                result.rows[0];


            const notificationData =
                generateShipmentNotification(
                    updatedShipment,
                    normalizedStatus
                );


            const notificationResult =
                await createShipmentNotification({

                    shipmentId:
                        updatedShipment.id,

                    status:
                        normalizedStatus,

                    title:
                        notificationData.title,

                    message:
                        notificationData.message,

                    priority:
                        notificationData.priority

                });


            if (
                notificationResult.created
            ) {

                notification =
                    notificationResult.notification;

            }

        } catch (notificationError) {

            console.error(
                "Notification creation failed:",
                notificationError
            );

        }


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                "Shipment status updated successfully",

            data:
                result.rows[0],

            notification

        });

    } catch (error) {

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

    }

};


// ======================================================
// UPDATE SHIPMENT
// ======================================================
//
// PATCH /api/shipments/:id
//
// Body:
//
// {
//     "origin": "Hyderabad, India",
//     "destination": "New York, USA",
//     "priority": "HIGH",
//     "expected_delivery": "2026-08-20T12:30:00Z"
// }
//
// ======================================================

const updateShipment = async (
    req,
    res
) => {

    try {

        const { id } = req.params;


        const {
            origin,
            destination,
            priority,
            expected_delivery
        } = req.body;


        const normalizedPriority =
            priority
                ? priority.trim().toUpperCase()
                : null;


        const result =
            await pool.query(
                `
                UPDATE shipments

                SET

                    origin =
                        COALESCE(
                            $1,
                            origin
                        ),

                    destination =
                        COALESCE(
                            $2,
                            destination
                        ),

                    priority =
                        COALESCE(
                            $3,
                            priority
                        ),

                    expected_delivery =
                        COALESCE(
                            $4,
                            expected_delivery
                        ),

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $5

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
                [
                    origin
                        ? origin.trim()
                        : null,

                    destination
                        ? destination.trim()
                        : null,

                    normalizedPriority,

                    expected_delivery
                        || null,

                    id
                ]
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
// DELETE SHIPMENT
// ======================================================
//
// DELETE /api/shipments/:id
//
// ======================================================

const deleteShipment = async (
    req,
    res
) => {

    try {

        const { id } = req.params;


        const result =
            await pool.query(
                `
                DELETE FROM shipments

                WHERE id = $1

                RETURNING

                    id,
                    tracking_number,
                    customer_id,
                    carrier_id
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
// EXPORT
// ======================================================

module.exports = {

    getAllShipments,

    getShipmentById,

    getShipmentByTrackingNumber,

    createShipment,

    updateShipmentStatus,

    updateShipment,

    deleteShipment

};