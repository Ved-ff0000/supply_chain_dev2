const pool = require("../config/database");

const { addClient } = require("../services/realtimeService");


// ======================================================
// GET ALL NOTIFICATIONS
// ======================================================
//
// GET /api/notifications
//
// CUSTOMER:
//     Only their own notifications
//
// ADMIN / OPERATIONS:
//     Can optionally use ?customer_id=1
//
// Filters:
//
// ?status=UNREAD
// ?status=READ
// ?type=DELIVERED
// ?priority=HIGH
// ?channel=IN_APP
// ?customer_id=1
//
// ======================================================

const getAllNotifications = async (req, res) => {

    try {

        let customerId =
            req.user.customer_id;

        const userRole =
            String(req.user.role || "").toUpperCase();


        // ==================================================
        // ADMIN / OPERATIONS CAN FILTER BY CUSTOMER
        // ==================================================

        if (
            (
                userRole === "ADMIN" ||
                userRole === "OPERATIONS"
            ) &&
            req.query.customer_id
        ) {

            customerId =
                req.query.customer_id;

        }


        if (
            userRole === "CUSTOMER" &&
            !customerId
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Customer account is not linked to a customer profile"

            });

        }


        // Non-privileged users must always be scoped
        if (
            userRole !== "ADMIN" &&
            userRole !== "OPERATIONS" &&
            !customerId
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Customer scope is required"

            });

        }


        const {
            status,
            type,
            priority,
            channel
        } = req.query;


        const conditions = [];

        const values = [];


        // ==================================================
        // CUSTOMER OWNERSHIP
        // ==================================================

        if (customerId) {

            values.push(customerId);

            conditions.push(
                `n.customer_id = $${values.length}`
            );

        }


        // ==================================================
        // STATUS FILTER
        // ==================================================

        if (status) {

            values.push(
                status.trim().toUpperCase()
            );

            conditions.push(
                `n.status = $${values.length}`
            );

        }


        // ==================================================
        // TYPE FILTER
        // ==================================================

        if (type) {

            values.push(
                type.trim().toUpperCase()
            );

            conditions.push(
                `n.type = $${values.length}`
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
                `n.priority = $${values.length}`
            );

        }


        // ==================================================
        // CHANNEL FILTER
        // ==================================================

        if (channel) {

            values.push(
                channel.trim().toUpperCase()
            );

            conditions.push(
                `n.channel = $${values.length}`
            );

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

                n.id,

                n.shipment_id,

                s.tracking_number,

                n.customer_id,

                n.type,

                n.title,

                n.message,

                n.channel,

                n.status,

                n.priority,

                n.created_at,

                n.read_at

            FROM notifications n

            LEFT JOIN shipments s
                ON n.shipment_id = s.id

            ${whereClause}

            ORDER BY
                n.created_at DESC,
                n.id DESC
            `,
            values
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
            "Error fetching notifications:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch notifications",

            error:
                error.message

        });

    }

};


// ======================================================
// GET NOTIFICATION BY ID
// ======================================================
//
// GET /api/notifications/:id
//
// IMPORTANT:
// Customer can only access their own notification.
//
// ======================================================

const getNotificationById = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        const customerId =
            req.user.customer_id;


        // ==================================================
        // CUSTOMER
        // ==================================================

        let query = `
            SELECT

                n.id,

                n.shipment_id,

                s.tracking_number,

                n.customer_id,

                n.type,

                n.title,

                n.message,

                n.channel,

                n.status,

                n.priority,

                n.created_at,

                n.read_at

            FROM notifications n

            LEFT JOIN shipments s
                ON n.shipment_id = s.id

            WHERE n.id = $1
        `;


        const values = [id];


        // ==================================================
        // CUSTOMER OWNERSHIP
        // ==================================================

        if (
            req.user.role === "CUSTOMER"
        ) {

            query +=
                ` AND n.customer_id = $2`;

            values.push(customerId);

        }


        // ==================================================
        // ADMIN / OPERATIONS
        // ==================================================

        const result =
            await pool.query(
                query,
                values
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Notification not found"

            });

        }


        return res.status(200).json({

            success: true,

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error fetching notification:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch notification",

            error:
                error.message

        });

    }

};


// ======================================================
// GET UNREAD NOTIFICATION COUNT
// ======================================================
//
// GET /api/notifications/unread-count
//
// ======================================================

const getUnreadNotificationCount = async (
    req,
    res
) => {

    try {

        const isStaff =
            req.user.role === "ADMIN" ||
            req.user.role === "OPERATIONS";


        let customerId =
            req.user.customer_id;


        // ==================================================
        // ADMIN / OPERATIONS
        // ==================================================
        //
        // Staff may scope the count to one customer via ?customer_id.
        // Without that parameter they see the fleet-wide unread total,
        // which is what the "Unread Notifications" KPI card reads.

        if (isStaff && req.query.customer_id) {

            customerId =
                Number(req.query.customer_id);

        } else if (isStaff) {

            customerId = null;

        }


        // A CUSTOMER account with no linked customer record has nothing
        // to count; that is an empty inbox, not a bad request.

        if (!isStaff && !customerId) {

            return res.status(200).json({

                success: true,

                unread_count: 0

            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS unread_count

                FROM notifications

                WHERE status = 'UNREAD'

                  AND (
                        $1::integer IS NULL
                        OR customer_id = $1::integer
                      )
                `,
                [customerId || null]
            );


        return res.status(200).json({

            success: true,

            unread_count:
                result.rows[0].unread_count

        });

    } catch (error) {

        console.error(
            "Error fetching unread notification count:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch unread notification count",

            error:
                error.message

        });

    }

};


// ======================================================
// MARK NOTIFICATION AS READ
// ======================================================
//
// PATCH /api/notifications/:id/read
//
// IMPORTANT:
// Ownership is checked BEFORE UPDATE.
//
// ======================================================

const markNotificationAsRead = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        const customerId =
            req.user.customer_id;


        // ==================================================
        // CUSTOMER OWNERSHIP CHECK
        // ==================================================
        //
        // DO NOT UPDATE FIRST.
        //
        // First verify that the notification belongs
        // to the logged-in customer.
        //
        // ==================================================

        if (
            req.user.role === "CUSTOMER"
        ) {

            const ownershipResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        customer_id,
                        status

                    FROM notifications

                    WHERE id = $1

                    AND customer_id = $2
                    `,
                    [
                        id,
                        customerId
                    ]
                );


            if (
                ownershipResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Notification not found"

                });

            }

        }


        // ==================================================
        // ADMIN / OPERATIONS
        // ==================================================

        const result =
            await pool.query(
                `
                UPDATE notifications

                SET

                    status = 'READ',

                    read_at =
                        COALESCE(
                            read_at,
                            CURRENT_TIMESTAMP
                        )

                WHERE id = $1

                RETURNING

                    id,

                    shipment_id,

                    customer_id,

                    type,

                    title,

                    message,

                    channel,

                    status,

                    priority,

                    created_at,

                    read_at
                `,
                [id]
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Notification not found"

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Notification marked as read",

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error marking notification as read:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to mark notification as read",

            error:
                error.message

        });

    }

};


// ======================================================
// MARK ALL NOTIFICATIONS AS READ
// ======================================================
//
// PATCH /api/notifications/read-all
//
// ======================================================

const markAllNotificationsAsRead = async (
    req,
    res
) => {

    try {

        let customerId =
            req.user.customer_id;


        // ==================================================
        // ADMIN / OPERATIONS
        // ==================================================

        if (
            (
                req.user.role === "ADMIN" ||
                req.user.role === "OPERATIONS"
            ) &&
            req.body.customer_id
        ) {

            customerId =
                req.body.customer_id;

        }


        if (!customerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Customer ID is required"

            });

        }


        const result =
            await pool.query(
                `
                UPDATE notifications

                SET

                    status = 'READ',

                    read_at =
                        COALESCE(
                            read_at,
                            CURRENT_TIMESTAMP
                        )

                WHERE customer_id = $1

                AND status = 'UNREAD'

                RETURNING id
                `,
                [customerId]
            );


        return res.status(200).json({

            success: true,

            message:
                "All notifications marked as read",

            updated_count:
                result.rows.length

        });

    } catch (error) {

        console.error(
            "Error marking all notifications as read:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to mark all notifications as read",

            error:
                error.message

        });

    }

};


// ======================================================
// DELETE NOTIFICATION
// ======================================================
//
// DELETE /api/notifications/:id
//
// CUSTOMER:
//     Can delete only their own notification.
//
// ADMIN / OPERATIONS:
//     Can delete any notification.
//
// ======================================================

const deleteNotification = async (
    req,
    res
) => {

    try {

        const { id } =
            req.params;


        const customerId =
            req.user.customer_id;


        let query = `
            DELETE FROM notifications

            WHERE id = $1
        `;


        const values = [id];


        // ==================================================
        // OWNERSHIP CHECK
        // ==================================================

        if (
            req.user.role === "CUSTOMER"
        ) {

            query +=
                ` AND customer_id = $2`;

            values.push(customerId);

        }


        query += `
            RETURNING

                id,

                shipment_id,

                customer_id,

                type,

                title,

                message,

                channel,

                status,

                priority,

                created_at,

                read_at
        `;


        const result =
            await pool.query(
                query,
                values
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Notification not found"

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Notification deleted successfully",

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error deleting notification:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to delete notification",

            error:
                error.message

        });

    }

};


// ======================================================
// GET NOTIFICATIONS FOR A SHIPMENT
// ======================================================
//
// GET /api/notifications/shipment/:shipmentId
//
// ======================================================

const getShipmentNotifications = async (
    req,
    res
) => {

    try {

        const {
            shipmentId
        } = req.params;


        const customerId =
            req.user.customer_id;


        let query = `
            SELECT

                n.id,

                n.shipment_id,

                s.tracking_number,

                n.customer_id,

                n.type,

                n.title,

                n.message,

                n.channel,

                n.status,

                n.priority,

                n.created_at,

                n.read_at

            FROM notifications n

            JOIN shipments s
                ON n.shipment_id = s.id

            WHERE n.shipment_id = $1
        `;


        const values = [
            shipmentId
        ];


        // ==================================================
        // CUSTOMER OWNERSHIP
        // ==================================================

        if (
            req.user.role === "CUSTOMER"
        ) {

            query +=
                ` AND n.customer_id = $2`;

            values.push(customerId);

        }


        query += `
            ORDER BY
                n.created_at DESC,
                n.id DESC
        `;


        const result =
            await pool.query(
                query,
                values
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
            "Error fetching shipment notifications:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch shipment notifications",

            error:
                error.message

        });

    }

};


// ======================================================
// LIVE NOTIFICATION STREAM (SSE)
// ======================================================
//
// GET /api/notifications/stream
//
// EventSource cannot set an Authorization header, so this endpoint also
// accepts the access token via ?token=. The connection is held open until
// the client disconnects.
//
// ======================================================

const streamNotifications = async (req, res) => {

    try {

        addClient(req, res, req.user);

    } catch (error) {

        console.error(
            "Notification stream error:",
            error
        );


        if (!res.headersSent) {

            return res.status(500).json({

                success: false,

                message: "Failed to open notification stream"

            });

        }

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getAllNotifications,

    getNotificationById,

    getUnreadNotificationCount,

    markNotificationAsRead,

    markAllNotificationsAsRead,

    deleteNotification,

    getShipmentNotifications,

    streamNotifications

};