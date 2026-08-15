
const pool = require("../config/database");

const {
    createShipmentNotification,
    generateShipmentNotification
} = require("./notificationService");


// ======================================================
// GET ALL SHIPMENTS
// ======================================================

const getAllShipments = async (filters = {}) => {

    const {
        status,
        priority,
        carrier_id,
        customer_id,
        search
    } = filters;

    const conditions = [];
    const values = [];


    // STATUS FILTER
    if (status) {

        values.push(
            status.trim().toUpperCase()
        );

        conditions.push(
            `s.status = $${values.length}::text`
        );
    }


    // PRIORITY FILTER
    if (priority) {

        values.push(
            priority.trim().toUpperCase()
        );

        conditions.push(
            `s.priority = $${values.length}::text`
        );
    }


    // CARRIER FILTER
    if (carrier_id) {

        values.push(
            Number(carrier_id)
        );

        conditions.push(
            `s.carrier_id = $${values.length}`
        );
    }


    // CUSTOMER FILTER
    if (customer_id) {

        values.push(
            Number(customer_id)
        );

        conditions.push(
            `s.customer_id = $${values.length}`
        );
    }


    // SEARCH
    if (search) {

        values.push(
            `%${search.trim()}%`
        );

        const index = values.length;

        conditions.push(`
            (
                s.tracking_number ILIKE $${index}::text
                OR c.name ILIKE $${index}::text
                OR c.email ILIKE $${index}::text
                OR ca.name ILIKE $${index}::text
            )
        `);
    }


    const whereClause =
        conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";


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


    return {
        count: result.rows.length,
        shipments: result.rows
    };
};


// ======================================================
// GET SHIPMENT BY ID
// ======================================================

const getShipmentById = async (id) => {

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
        [Number(id)]
    );


    if (result.rows.length === 0) {
        return null;
    }


    return result.rows[0];
};


// ======================================================
// GET SHIPMENT BY TRACKING NUMBER
// ======================================================

const getShipmentByTrackingNumber = async (
    trackingNumber
) => {

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
        [trackingNumber.trim()]
    );


    if (result.rows.length === 0) {
        return null;
    }


    return result.rows[0];
};


// ======================================================
// CREATE SHIPMENT
// ======================================================

const createShipment = async (shipmentData) => {

    const {
        tracking_number,
        carrier_id,
        customer_id,
        origin,
        destination,
        status,
        priority,
        expected_delivery
    } = shipmentData;


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

        const error = new Error(
            "tracking_number, carrier_id, customer_id, origin and destination are required"
        );

        error.statusCode = 400;

        throw error;
    }


    const normalizedTrackingNumber =
        tracking_number.trim();

    const normalizedOrigin =
        origin.trim();

    const normalizedDestination =
        destination.trim();

    const normalizedStatus =
        status
            ? status.trim().toUpperCase()
            : "IN_TRANSIT";

    const normalizedPriority =
        priority
            ? priority.trim().toUpperCase()
            : "NORMAL";


    const client =
        await pool.connect();


    try {

        await client.query("BEGIN");


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
                [Number(carrier_id)]
            );


        if (carrierResult.rows.length === 0) {

            const error =
                new Error("Carrier not found");

            error.statusCode = 404;

            throw error;
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
                [Number(customer_id)]
            );


        if (customerResult.rows.length === 0) {

            const error =
                new Error("Customer not found");

            error.statusCode = 404;

            throw error;
        }


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
                    normalizedTrackingNumber,
                    Number(carrier_id),
                    Number(customer_id),
                    normalizedOrigin,
                    normalizedDestination,
                    normalizedStatus,
                    normalizedPriority,
                    expected_delivery || null
                ]
            );


        await client.query("COMMIT");


        const shipment =
            result.rows[0];


        // ==================================================
        // INITIAL NOTIFICATION
        // ==================================================

        let notification = null;


        try {

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


        return {
            shipment,
            notification
        };


    } catch (error) {

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


        throw error;


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
//     "status": "DELIVERED"
// }
//
// ======================================================

const updateShipmentStatus = async (
    id,
    status
) => {

    // ==================================================
    // VALIDATION
    // ==================================================

    if (
        !status ||
        typeof status !== "string"
    ) {

        const error =
            new Error("Status is required");

        error.statusCode = 400;

        throw error;
    }


    const normalizedStatus =
        status.trim().toUpperCase();


    if (!normalizedStatus) {

        const error =
            new Error("Status cannot be empty");

        error.statusCode = 400;

        throw error;
    }


    const shipmentId =
        Number(id);


    if (
        !Number.isInteger(shipmentId) ||
        shipmentId <= 0
    ) {

        const error =
            new Error("Invalid shipment ID");

        error.statusCode = 400;

        throw error;
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
            [shipmentId]
        );


    if (
        currentResult.rows.length === 0
    ) {

        const error =
            new Error("Shipment not found");

        error.statusCode = 404;

        throw error;
    }


    const currentShipment =
        currentResult.rows[0];


    // ==================================================
    // SAME STATUS
    // ==================================================

    if (
        currentShipment.status ===
        normalizedStatus
    ) {

        return {

            shipment:
                currentShipment,

            notification:
                null,

            alreadyUpdated:
                true

        };
    }


    // ==================================================
    // UPDATE STATUS
    // ==================================================
    //
    // IMPORTANT:
    // Use $1::text EVERYWHERE $1 is used.
    //
    // This fixes:
    //
    // inconsistent types deduced for parameter $1
    //
    // ==================================================

    const result =
        await pool.query(
            `
            UPDATE shipments

            SET

                status =
                    $1::text,

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
                normalizedStatus,
                shipmentId
            ]
        );


    if (
        result.rows.length === 0
    ) {

        const error =
            new Error("Shipment not found");

        error.statusCode = 404;

        throw error;
    }


    const updatedShipment =
        result.rows[0];


    // ==================================================
    // CREATE NOTIFICATION
    // ==================================================

    let notification = null;


    try {

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


    return {

        shipment:
            updatedShipment,

        notification,

        alreadyUpdated:
            false

    };
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
    id,
    shipmentData
) => {

    const {
        origin,
        destination,
        priority,
        expected_delivery
    } = shipmentData || {};


    const shipmentId =
        Number(id);


    if (
        !Number.isInteger(shipmentId) ||
        shipmentId <= 0
    ) {

        const error =
            new Error("Invalid shipment ID");

        error.statusCode = 400;

        throw error;
    }


    // ==================================================
    // NORMALIZE VALUES
    // ==================================================

    const normalizedOrigin =
        typeof origin === "string" &&
        origin.trim() !== ""
            ? origin.trim()
            : null;


    const normalizedDestination =
        typeof destination === "string" &&
        destination.trim() !== ""
            ? destination.trim()
            : null;


    const normalizedPriority =
        typeof priority === "string" &&
        priority.trim() !== ""
            ? priority.trim().toUpperCase()
            : null;


    const normalizedExpectedDelivery =
        expected_delivery || null;


    // ==================================================
    // UPDATE SHIPMENT
    // ==================================================

    const result =
        await pool.query(
            `
            UPDATE shipments

            SET

                origin =
                    COALESCE(
                        $1::text,
                        origin
                    ),

                destination =
                    COALESCE(
                        $2::text,
                        destination
                    ),

                priority =
                    COALESCE(
                        $3::text,
                        priority
                    ),

                expected_delivery =
                    COALESCE(
                        $4::timestamp,
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
                normalizedOrigin,
                normalizedDestination,
                normalizedPriority,
                normalizedExpectedDelivery,
                shipmentId
            ]
        );


    // ==================================================
    // NOT FOUND
    // ==================================================

    if (
        result.rows.length === 0
    ) {

        return null;
    }


    return result.rows[0];
};


// ======================================================
// DELETE SHIPMENT
// ======================================================

const deleteShipment = async (
    id
) => {

    const shipmentId =
        Number(id);


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
            [shipmentId]
        );


    if (
        result.rows.length === 0
    ) {

        return null;
    }


    return result.rows[0];
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

