const pool = require("../config/database");


// ======================================================
// GET DASHBOARD SUMMARY
// ======================================================
//
// GET /api/dashboard/summary
//
// ======================================================

const getDashboardSummary = async (req, res) => {

    try {

        // ==================================================
        // SHIPMENT SUMMARY
        // ==================================================

        const shipmentSummary = await pool.query(`
            SELECT
                COUNT(*) AS total_shipments,

                COUNT(*) FILTER (
                    WHERE status = 'IN_TRANSIT'
                ) AS in_transit,

                COUNT(*) FILTER (
                    WHERE status = 'DELIVERED'
                ) AS delivered,

                COUNT(*) FILTER (
                    WHERE status = 'CUSTOMS_HOLD'
                ) AS customs_hold,

                COUNT(*) FILTER (
                    WHERE status = 'OUT_FOR_DELIVERY'
                ) AS out_for_delivery,

                COUNT(*) FILTER (
                    WHERE status = 'DELAYED'
                ) AS delayed,

                COUNT(*) FILTER (
                    WHERE priority = 'URGENT'
                ) AS urgent,

                COUNT(*) FILTER (
                    WHERE priority = 'HIGH'
                ) AS high_priority

            FROM shipments
        `);


        // ==================================================
        // NOTIFICATION SUMMARY
        // ==================================================

        const notificationSummary = await pool.query(`
            SELECT

                COUNT(*) AS total_notifications,

                COUNT(*) FILTER (
                    WHERE status = 'UNREAD'
                ) AS unread_notifications,

                COUNT(*) FILTER (
                    WHERE status = 'READ'
                ) AS read_notifications,

                COUNT(*) FILTER (
                    WHERE priority = 'URGENT'
                ) AS urgent_notifications

            FROM notifications
        `);


        // ==================================================
        // CUSTOMER COUNT
        // ==================================================

        const customerResult = await pool.query(`
            SELECT COUNT(*) AS total_customers
            FROM customers
        `);


        // ==================================================
        // CARRIER COUNT
        // ==================================================

        const carrierResult = await pool.query(`
            SELECT COUNT(*) AS total_carriers
            FROM carriers
        `);


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(200).json({

            success: true,

            data: {

                shipments:
                    shipmentSummary.rows[0],

                notifications:
                    notificationSummary.rows[0],

                total_customers:
                    Number(
                        customerResult.rows[0].total_customers
                    ),

                total_carriers:
                    Number(
                        carrierResult.rows[0].total_carriers
                    )

            }

        });

    } catch (error) {

        console.error(
            "Error fetching dashboard summary:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch dashboard summary",

            error:
                error.message

        });

    }

};


// ======================================================
// SHIPMENTS BY STATUS
// ======================================================
//
// GET /api/dashboard/shipments/status
//
// ======================================================

const getShipmentsByStatus = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                status,
                COUNT(*) AS count

            FROM shipments

            GROUP BY status

            ORDER BY count DESC
        `);


        return res.status(200).json({

            success: true,

            data:
                result.rows

        });

    } catch (error) {

        console.error(
            "Error fetching shipment status statistics:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch shipment status statistics",

            error:
                error.message

        });

    }

};


// ======================================================
// SHIPMENTS BY PRIORITY
// ======================================================
//
// GET /api/dashboard/shipments/priority
//
// ======================================================

const getShipmentsByPriority = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                priority,
                COUNT(*) AS count

            FROM shipments

            GROUP BY priority

            ORDER BY count DESC
        `);


        return res.status(200).json({

            success: true,

            data:
                result.rows

        });

    } catch (error) {

        console.error(
            "Error fetching shipment priority statistics:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch shipment priority statistics",

            error:
                error.message

        });

    }

};


// ======================================================
// SHIPMENTS BY CARRIER
// ======================================================
//
// GET /api/dashboard/shipments/carriers
//
// ======================================================

const getShipmentsByCarrier = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT

                ca.id AS carrier_id,

                ca.name AS carrier,

                ca.code AS carrier_code,

                COUNT(s.id) AS shipment_count

            FROM carriers ca

            LEFT JOIN shipments s
                ON ca.id = s.carrier_id

            GROUP BY
                ca.id,
                ca.name,
                ca.code

            ORDER BY
                shipment_count DESC
        `);


        return res.status(200).json({

            success: true,

            data:
                result.rows

        });

    } catch (error) {

        console.error(
            "Error fetching carrier statistics:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch carrier statistics",

            error:
                error.message

        });

    }

};


// ======================================================
// RECENT SHIPMENTS
// ======================================================
//
// GET /api/dashboard/recent-shipments
//
// ======================================================

const getRecentShipments = async (req, res) => {

    try {

        const limit =
            Math.min(
                Number(req.query.limit) || 10,
                50
            );


        const result = await pool.query(
            `
            SELECT

                s.id,

                s.tracking_number,

                c.name AS customer,

                ca.name AS carrier,

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

            LIMIT $1
            `,
            [limit]
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
            "Error fetching recent shipments:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch recent shipments",

            error:
                error.message

        });

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getDashboardSummary,

    getShipmentsByStatus,

    getShipmentsByPriority,

    getShipmentsByCarrier,

    getRecentShipments

};