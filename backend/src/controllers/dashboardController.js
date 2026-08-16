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

            WHERE s.is_deleted = FALSE

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
// DELIVERIES OVER TIME (TIME-SERIES AGGREGATION)
// ======================================================
//
// GET /api/dashboard/deliveries-over-time?interval=day&range=30d
//
// ======================================================

const getDeliveriesOverTime = async (req, res) => {
    try {
        const rawInterval = String(req.query.interval || "day").trim().toLowerCase();
        const allowedIntervals = {
            day: "day",
            daily: "day",
            week: "week",
            weekly: "week",
            month: "month",
            monthly: "month"
        };

        const intervalBucket = allowedIntervals[rawInterval] || "day";

        // Map range parameter to PostgreSQL interval string safely
        const rawRange = String(req.query.range || "30d").trim().toLowerCase();
        const rangeMap = {
            "7d": "7 days",
            "14d": "14 days",
            "30d": "30 days",
            "60d": "60 days",
            "90d": "90 days",
            "180d": "180 days",
            "1y": "365 days",
            "365d": "365 days"
        };

        const rangeInterval = rangeMap[rawRange] || "30 days";

        // CUSTOMER accounts only ever see their own deliveries.
        const role = String(req.user.role || "").toUpperCase();

        const scopeId =
            role === "CUSTOMER"
                ? req.user.customer_id || -1
                : req.query.customer_id
                    ? Number(req.query.customer_id)
                    : null;

        const result = await pool.query(
            `
            SELECT
                date_trunc($1, s.actual_delivery) AS time_bucket,
                COUNT(*)::int AS delivery_count,
                COUNT(*) FILTER (
                    WHERE s.expected_delivery IS NOT NULL 
                      AND s.actual_delivery <= s.expected_delivery
                )::int AS on_time_count,
                COUNT(*) FILTER (
                    WHERE s.expected_delivery IS NOT NULL 
                      AND s.actual_delivery > s.expected_delivery
                )::int AS late_count
            FROM shipments s
            WHERE s.status = 'DELIVERED'
              AND s.actual_delivery IS NOT NULL
              AND s.is_deleted = FALSE
              AND s.actual_delivery >= CURRENT_TIMESTAMP - $2::interval
              AND ($3::int IS NULL OR s.customer_id = $3::int)
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
            `,
            [intervalBucket, rangeInterval, scopeId]
        );

        return res.status(200).json({
            success: true,
            interval: intervalBucket,
            range: rawRange,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error fetching deliveries over time:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch deliveries over time",
            error: error.message
        });
    }
};


// ======================================================
// AVERAGE TRANSIT TIME BY CARRIER
// ======================================================
//
// GET /api/dashboard/avg-transit-time
//
// ======================================================

const getAvgTransitTime = async (req, res) => {
    try {
        const role = String(req.user.role || "").toUpperCase();

        const scopeId =
            role === "CUSTOMER"
                ? req.user.customer_id || -1
                : req.query.customer_id
                    ? Number(req.query.customer_id)
                    : null;

        const result = await pool.query(
            `
            SELECT
                ca.id AS carrier_id,
                ca.name AS carrier_name,
                ca.code AS carrier_code,
                COUNT(s.id)::int AS delivered_shipments,
                ROUND(AVG(EXTRACT(EPOCH FROM (s.actual_delivery - s.created_at)) / 3600.0)::numeric, 2)::float AS avg_transit_hours,
                ROUND(AVG(EXTRACT(EPOCH FROM (s.actual_delivery - s.created_at)) / 86400.0)::numeric, 2)::float AS avg_transit_days,
                ROUND(MIN(EXTRACT(EPOCH FROM (s.actual_delivery - s.created_at)) / 3600.0)::numeric, 2)::float AS min_transit_hours,
                ROUND(MAX(EXTRACT(EPOCH FROM (s.actual_delivery - s.created_at)) / 3600.0)::numeric, 2)::float AS max_transit_hours
            FROM carriers ca
            LEFT JOIN shipments s 
                ON ca.id = s.carrier_id 
               AND s.status = 'DELIVERED' 
               AND s.actual_delivery IS NOT NULL 
               AND s.actual_delivery >= s.created_at
               AND s.is_deleted = FALSE
               AND ($1::int IS NULL OR s.customer_id = $1::int)
            WHERE ca.is_deleted = FALSE
            GROUP BY ca.id, ca.name, ca.code
            ORDER BY avg_transit_hours ASC NULLS LAST
            `,
            [scopeId]
        );

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error fetching average transit time:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch average transit time",
            error: error.message
        });
    }
};


// ======================================================
// ON-TIME DELIVERY RATE
// ======================================================
//
// GET /api/dashboard/on-time-rate
//
// ======================================================

const getOnTimeRate = async (req, res) => {
    try {
        const role = String(req.user.role || "").toUpperCase();

        const scopeId =
            role === "CUSTOMER"
                ? req.user.customer_id || -1
                : req.query.customer_id
                    ? Number(req.query.customer_id)
                    : null;

        // 1. Overall aggregation
        const overallResult = await pool.query(
            `
            SELECT
                COUNT(s.id)::int AS total_evaluated_shipments,
                COUNT(s.id) FILTER (WHERE s.actual_delivery <= s.expected_delivery)::int AS on_time_count,
                COUNT(s.id) FILTER (WHERE s.actual_delivery > s.expected_delivery)::int AS late_count,
                ROUND(
                    (COUNT(s.id) FILTER (WHERE s.actual_delivery <= s.expected_delivery) * 100.0 / NULLIF(COUNT(s.id), 0))::numeric, 
                    2
                )::float AS overall_on_time_rate_pct
            FROM shipments s
            WHERE s.status = 'DELIVERED'
              AND s.expected_delivery IS NOT NULL
              AND s.actual_delivery IS NOT NULL
              AND s.is_deleted = FALSE
              AND ($1::int IS NULL OR s.customer_id = $1::int)
            `,
            [scopeId]
        );

        // 2. Carrier breakdown
        const carrierBreakdown = await pool.query(
            `
            SELECT
                ca.id AS carrier_id,
                ca.name AS carrier_name,
                ca.code AS carrier_code,
                COUNT(s.id)::int AS total_evaluated_shipments,
                COUNT(s.id) FILTER (WHERE s.actual_delivery <= s.expected_delivery)::int AS on_time_count,
                COUNT(s.id) FILTER (WHERE s.actual_delivery > s.expected_delivery)::int AS late_count,
                ROUND(
                    (COUNT(s.id) FILTER (WHERE s.actual_delivery <= s.expected_delivery) * 100.0 / NULLIF(COUNT(s.id), 0))::numeric, 
                    2
                )::float AS on_time_rate_pct
            FROM carriers ca
            LEFT JOIN shipments s 
                ON ca.id = s.carrier_id 
               AND s.status = 'DELIVERED' 
               AND s.expected_delivery IS NOT NULL 
               AND s.actual_delivery IS NOT NULL 
               AND s.is_deleted = FALSE
               AND ($1::int IS NULL OR s.customer_id = $1::int)
            WHERE ca.is_deleted = FALSE
            GROUP BY ca.id, ca.name, ca.code
            ORDER BY on_time_rate_pct DESC NULLS LAST
            `,
            [scopeId]
        );

        return res.status(200).json({
            success: true,
            data: {
                summary: overallResult.rows[0],
                carriers: carrierBreakdown.rows
            }
        });
    } catch (error) {
        console.error("Error fetching on-time delivery rate:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch on-time rate",
            error: error.message
        });
    }
};


// ======================================================
// CUSTOMS HOLD FREQUENCY (BY ROUTE & BY CARRIER)
// ======================================================
//
// GET /api/dashboard/customs-hold-frequency
//
// ======================================================

const getCustomsHoldFrequency = async (req, res) => {
    try {
        // 1. By Route (Origin -> Destination)
        const routeResult = await pool.query(
            `
            SELECT 
                s.origin,
                s.destination,
                COUNT(DISTINCT s.id)::int AS total_shipments,
                COUNT(DISTINCT CASE WHEN e.status = 'CUSTOMS_HOLD' THEN s.id END)::int AS customs_hold_count,
                ROUND(
                    (COUNT(DISTINCT CASE WHEN e.status = 'CUSTOMS_HOLD' THEN s.id END) * 100.0 / NULLIF(COUNT(DISTINCT s.id), 0))::numeric,
                    2
                )::float AS hold_rate_pct
            FROM shipments s
            LEFT JOIN shipment_events e 
                ON s.id = e.shipment_id 
               AND e.is_deleted = FALSE
            WHERE s.is_deleted = FALSE
            GROUP BY s.origin, s.destination
            HAVING COUNT(DISTINCT s.id) > 0
            ORDER BY customs_hold_count DESC, total_shipments DESC
            `
        );

        // 2. By Carrier
        const carrierResult = await pool.query(
            `
            SELECT 
                ca.id AS carrier_id,
                ca.name AS carrier_name,
                ca.code AS carrier_code,
                COUNT(DISTINCT s.id)::int AS total_shipments,
                COUNT(DISTINCT CASE WHEN e.status = 'CUSTOMS_HOLD' THEN s.id END)::int AS customs_hold_count,
                ROUND(
                    (COUNT(DISTINCT CASE WHEN e.status = 'CUSTOMS_HOLD' THEN s.id END) * 100.0 / NULLIF(COUNT(DISTINCT s.id), 0))::numeric,
                    2
                )::float AS hold_rate_pct
            FROM carriers ca
            LEFT JOIN shipments s 
                ON ca.id = s.carrier_id 
               AND s.is_deleted = FALSE
            LEFT JOIN shipment_events e 
                ON s.id = e.shipment_id 
               AND e.is_deleted = FALSE
            GROUP BY ca.id, ca.name, ca.code
            ORDER BY customs_hold_count DESC
            `
        );

        return res.status(200).json({
            success: true,
            data: {
                by_route: routeResult.rows,
                by_carrier: carrierResult.rows
            }
        });
    } catch (error) {
        console.error("Error fetching customs hold frequency:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch customs hold frequency",
            error: error.message
        });
    }
};


// ======================================================
// ROLE SCOPING HELPER
// ======================================================
//
// CUSTOMER accounts only ever see their own figures. Staff see the fleet.
// Returns a SQL fragment plus the parameter list so each KPI query can
// interpolate it consistently.
//
// ======================================================

const buildCustomerScope = (req, alias = "s") => {
    const role = String(req.user.role || "").toUpperCase();

    if (role === "CUSTOMER") {
        return {
            clause: ` AND ${alias}.customer_id = $1`,
            values: [req.user.customer_id || -1]
        };
    }

    // Staff may narrow to a single customer explicitly.
    if (req.query.customer_id) {
        return {
            clause: ` AND ${alias}.customer_id = $1`,
            values: [Number(req.query.customer_id)]
        };
    }

    return { clause: "", values: [] };
};


// ======================================================
// ACTIVE SHIPMENTS COUNT (KPI CARD)
// ======================================================
//
// GET /api/dashboard/active-shipments-count
//
// "Active" = not yet in a terminal state.
//
// ======================================================

const getActiveShipmentsCount = async (req, res) => {
    try {
        const scope = buildCustomerScope(req);

        const result = await pool.query(
            `
            SELECT
                COUNT(*)::int AS active_count,
                COUNT(*) FILTER (WHERE s.priority = 'URGENT')::int AS urgent_count,
                COUNT(*) FILTER (WHERE s.priority = 'HIGH')::int AS high_count,
                COUNT(*) FILTER (WHERE s.status = 'IN_TRANSIT')::int AS in_transit_count,
                COUNT(*) FILTER (WHERE s.status = 'PENDING_APPROVAL')::int AS pending_approval_count
            FROM shipments s
            WHERE s.is_deleted = FALSE
              AND s.status NOT IN ('DELIVERED', 'CANCELLED', 'LOST', 'RETURNED')
              ${scope.clause}
            `,
            scope.values
        );

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error fetching active shipments count:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch active shipments count",
            error: error.message
        });
    }
};


// ======================================================
// DELAYS IN LAST 24 HOURS (KPI CARD)
// ======================================================
//
// GET /api/dashboard/delays-24h
//
// Counts shipments whose DELAYED event was recorded in the window, which is
// the accurate reading of "delays in the last 24h" — a shipment delayed days
// ago that is still DELAYED should not inflate today's number.
//
// ======================================================

const getDelays24h = async (req, res) => {
    try {
        const hours = Math.min(
            Math.max(Number(req.query.hours) || 24, 1),
            720
        );

        const role = String(req.user.role || "").toUpperCase();
        const values = [hours];
        let scopeClause = "";

        if (role === "CUSTOMER") {
            values.push(req.user.customer_id || -1);
            scopeClause = ` AND s.customer_id = $${values.length}`;
        } else if (req.query.customer_id) {
            values.push(Number(req.query.customer_id));
            scopeClause = ` AND s.customer_id = $${values.length}`;
        }

        const result = await pool.query(
            `
            SELECT
                COUNT(DISTINCT s.id)::int AS delays_24h,
                COUNT(DISTINCT s.id) FILTER (
                    WHERE s.priority IN ('HIGH', 'URGENT')
                )::int AS high_priority_delays,
                COUNT(DISTINCT s.id) FILTER (
                    WHERE s.status = 'DELAYED'
                )::int AS still_delayed
            FROM shipments s
            JOIN shipment_events e
                ON e.shipment_id = s.id
               AND e.status = 'DELAYED'
               AND e.is_deleted = FALSE
               AND e.event_time >= CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 hour')
            WHERE s.is_deleted = FALSE
              ${scopeClause}
            `,
            values
        );

        return res.status(200).json({
            success: true,
            window_hours: hours,
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error fetching 24h delays:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch delays in the last 24 hours",
            error: error.message
        });
    }
};


// ======================================================
// UNREAD NOTIFICATIONS COUNT (KPI CARD)
// ======================================================
//
// GET /api/dashboard/unread-notifications-count
//
// ======================================================

const getUnreadNotificationsCount = async (req, res) => {
    try {
        const role = String(req.user.role || "").toUpperCase();
        const values = [];
        let scopeClause = "";

        if (role === "CUSTOMER") {
            values.push(req.user.customer_id || -1);
            scopeClause = ` AND n.customer_id = $${values.length}`;
        } else if (req.query.customer_id) {
            values.push(Number(req.query.customer_id));
            scopeClause = ` AND n.customer_id = $${values.length}`;
        }

        const result = await pool.query(
            `
            SELECT
                COUNT(*)::int AS unread_count,
                COUNT(*) FILTER (WHERE n.priority = 'URGENT')::int AS urgent_count,
                COUNT(*) FILTER (
                    WHERE n.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                )::int AS last_24h_count
            FROM notifications n
            WHERE n.status = 'UNREAD'
              ${scopeClause}
            `,
            values
        );

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error fetching unread notifications count:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch unread notifications count",
            error: error.message
        });
    }
};


// ======================================================
// CSV EXPORT (FEATURE 9)
// ======================================================
//
// GET /api/dashboard/export?dataset=deliveries|carriers|shipments&range=30d
//
// Streams a CSV attachment built from the same SQL aggregations that feed
// the dashboard, so an exported report always matches what is on screen.
//
// ======================================================

const RANGE_MAP = {
    "7d": "7 days",
    "14d": "14 days",
    "30d": "30 days",
    "60d": "60 days",
    "90d": "90 days",
    "180d": "180 days",
    "1y": "365 days",
    "365d": "365 days"
};

/**
 * RFC 4180 escaping: wrap in quotes and double any embedded quote.
 */
const toCsvValue = (value) => {
    if (value === null || value === undefined) {
        return "";
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    const stringValue = String(value);

    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
};

const rowsToCsv = (rows) => {
    if (!rows || rows.length === 0) {
        return "";
    }

    const headers = Object.keys(rows[0]);

    const lines = [
        headers.join(","),
        ...rows.map((row) =>
            headers.map((header) => toCsvValue(row[header])).join(",")
        )
    ];

    return lines.join("\r\n");
};

const exportDashboardCsv = async (req, res) => {
    try {
        const dataset = String(req.query.dataset || "deliveries")
            .trim()
            .toLowerCase();

        const rangeKey = String(req.query.range || "30d").trim().toLowerCase();
        const rangeInterval = RANGE_MAP[rangeKey] || "30 days";

        const role = String(req.user.role || "").toUpperCase();
        const isCustomer = role === "CUSTOMER";

        const scopeId = isCustomer
            ? req.user.customer_id || -1
            : req.query.customer_id
                ? Number(req.query.customer_id)
                : null;

        let rows = [];
        let filename = "dashboard-export.csv";

        if (dataset === "carriers") {
            const result = await pool.query(
                `
                SELECT
                    ca.name AS carrier,
                    ca.code AS carrier_code,
                    COUNT(s.id)::int AS delivered_shipments,
                    COUNT(s.id) FILTER (
                        WHERE s.actual_delivery <= s.expected_delivery
                    )::int AS on_time_count,
                    COUNT(s.id) FILTER (
                        WHERE s.actual_delivery > s.expected_delivery
                    )::int AS late_count,
                    ROUND(
                        (COUNT(s.id) FILTER (WHERE s.actual_delivery <= s.expected_delivery)
                         * 100.0 / NULLIF(COUNT(s.id), 0))::numeric, 2
                    )::float AS on_time_rate_pct,
                    ROUND(
                        AVG(EXTRACT(EPOCH FROM (s.actual_delivery - s.created_at)) / 3600.0)::numeric, 2
                    )::float AS avg_transit_hours
                FROM carriers ca
                LEFT JOIN shipments s
                    ON ca.id = s.carrier_id
                   AND s.status = 'DELIVERED'
                   AND s.expected_delivery IS NOT NULL
                   AND s.actual_delivery IS NOT NULL
                   AND s.is_deleted = FALSE
                   AND ($1::int IS NULL OR s.customer_id = $1::int)
                GROUP BY ca.id, ca.name, ca.code
                ORDER BY on_time_rate_pct DESC NULLS LAST
                `,
                [scopeId]
            );

            rows = result.rows;
            filename = `carrier-performance-${rangeKey}.csv`;
        } else if (dataset === "shipments") {
            const result = await pool.query(
                `
                SELECT
                    s.tracking_number,
                    c.name AS customer,
                    ca.name AS carrier,
                    s.origin,
                    s.destination,
                    s.status,
                    s.priority,
                    s.expected_delivery,
                    s.actual_delivery,
                    s.created_at
                FROM shipments s
                JOIN customers c ON c.id = s.customer_id
                JOIN carriers ca ON ca.id = s.carrier_id
                WHERE s.is_deleted = FALSE
                  AND s.created_at >= CURRENT_TIMESTAMP - $2::interval
                  AND ($1::int IS NULL OR s.customer_id = $1::int)
                ORDER BY s.created_at DESC
                `,
                [scopeId, rangeInterval]
            );

            rows = result.rows;
            filename = `shipments-${rangeKey}.csv`;
        } else {
            const result = await pool.query(
                `
                SELECT
                    to_char(date_trunc('day', s.actual_delivery), 'YYYY-MM-DD') AS date,
                    COUNT(*)::int AS delivery_count,
                    COUNT(*) FILTER (
                        WHERE s.expected_delivery IS NOT NULL
                          AND s.actual_delivery <= s.expected_delivery
                    )::int AS on_time_count,
                    COUNT(*) FILTER (
                        WHERE s.expected_delivery IS NOT NULL
                          AND s.actual_delivery > s.expected_delivery
                    )::int AS late_count
                FROM shipments s
                WHERE s.status = 'DELIVERED'
                  AND s.actual_delivery IS NOT NULL
                  AND s.is_deleted = FALSE
                  AND s.actual_delivery >= CURRENT_TIMESTAMP - $2::interval
                  AND ($1::int IS NULL OR s.customer_id = $1::int)
                GROUP BY date_trunc('day', s.actual_delivery)
                ORDER BY date_trunc('day', s.actual_delivery) ASC
                `,
                [scopeId, rangeInterval]
            );

            rows = result.rows;
            filename = `deliveries-over-time-${rangeKey}.csv`;
        }

        const csv = rows.length
            ? rowsToCsv(rows)
            : "no_data\r\nNo records matched the selected range";

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        return res.status(200).send(csv);
    } catch (error) {
        console.error("Error exporting dashboard CSV:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to export dashboard data",
            error: error.message
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
    getRecentShipments,
    getDeliveriesOverTime,
    getAvgTransitTime,
    getOnTimeRate,
    getCustomsHoldFrequency,
    getActiveShipmentsCount,
    getDelays24h,
    getUnreadNotificationsCount,
    exportDashboardCsv
};