const pool = require("../config/database");


// ======================================================
// DEFAULT PREFERENCES
// ======================================================

const DEFAULT_PREFERENCES = {
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


// ======================================================
// GET NOTIFICATION PREFERENCES
// ======================================================
//
// GET /api/notifications/preferences
//
// CUSTOMER:
// Gets their own preferences
//
// ADMIN / OPERATIONS:
// Can use ?customer_id=1
//
// ======================================================

const getNotificationPreferences = async (req, res) => {

    try {

        let customerId = req.user.customer_id;


        // ==================================================
        // ADMIN / OPERATIONS CAN SPECIFY CUSTOMER
        // ==================================================

        if (
            (
                req.user.role === "ADMIN" ||
                req.user.role === "OPERATIONS"
            ) &&
            req.query.customer_id
        ) {

            customerId = req.query.customer_id;

        }


        // ==================================================
        // VALIDATE CUSTOMER ID
        // ==================================================

        if (!customerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Customer ID is required"

            });

        }


        // ==================================================
        // GET EXISTING PREFERENCES
        // ==================================================

        const result = await pool.query(
            `
            SELECT
                id,
                customer_id,

                email_enabled,
                in_app_enabled,
                webhook_enabled,
                webhook_url,
                webhook_secret,

                notify_in_transit,
                notify_customs_hold,
                notify_delayed,
                notify_out_for_delivery,
                notify_delivered,

                created_at,
                updated_at

            FROM notification_preferences

            WHERE customer_id = $1
            `,
            [customerId]
        );


        // ==================================================
        // CREATE DEFAULT PREFERENCES
        // ==================================================

        if (result.rows.length === 0) {

            const created = await pool.query(
                `
                INSERT INTO notification_preferences (
                    customer_id,
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
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11
                )

                RETURNING
                    id,
                    customer_id,

                    email_enabled,
                    in_app_enabled,
                    webhook_enabled,
                    webhook_url,
                    webhook_secret,

                    notify_in_transit,
                    notify_customs_hold,
                    notify_delayed,
                    notify_out_for_delivery,
                    notify_delivered,

                    created_at,
                    updated_at
                `,
                [
                    customerId,
                    DEFAULT_PREFERENCES.email_enabled,
                    DEFAULT_PREFERENCES.in_app_enabled,
                    DEFAULT_PREFERENCES.webhook_enabled,
                    DEFAULT_PREFERENCES.webhook_url,
                    DEFAULT_PREFERENCES.webhook_secret,
                    DEFAULT_PREFERENCES.notify_in_transit,
                    DEFAULT_PREFERENCES.notify_customs_hold,
                    DEFAULT_PREFERENCES.notify_delayed,
                    DEFAULT_PREFERENCES.notify_out_for_delivery,
                    DEFAULT_PREFERENCES.notify_delivered
                ]
            );


            return res.status(200).json({

                success: true,

                message:
                    "Default notification preferences created",

                data:
                    created.rows[0]

            });

        }


        // ==================================================
        // RETURN EXISTING PREFERENCES
        // ==================================================

        return res.status(200).json({

            success: true,

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error fetching notification preferences:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch notification preferences",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

};


// ======================================================
// UPDATE NOTIFICATION PREFERENCES
// ======================================================
//
// PUT /api/notifications/preferences
//
// ======================================================

const updateNotificationPreferences = async (
    req,
    res
) => {

    try {

        let customerId = req.user.customer_id;


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

            customerId = req.body.customer_id;

        }


        // ==================================================
        // VALIDATE CUSTOMER ID
        // ==================================================

        if (!customerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Customer ID is required"

            });

        }


        // ==================================================
        // ALLOWED FIELDS
        // ==================================================

        const allowedFields = [

            "email_enabled",

            "in_app_enabled",

            "webhook_enabled",

            "webhook_url",

            "webhook_secret",

            "notify_in_transit",

            "notify_customs_hold",

            "notify_delayed",

            "notify_out_for_delivery",

            "notify_delivered"

        ];


        // ==================================================
        // BUILD UPDATE
        // ==================================================

        const updates = [];
        const values = [];


        for (const field of allowedFields) {

            if (req.body[field] !== undefined) {

                if (field === "webhook_url" || field === "webhook_secret") {
                    if (req.body[field] !== null && typeof req.body[field] !== "string") {
                        return res.status(400).json({
                            success: false,
                            message: `${field} must be a string or null`
                        });
                    }
                    values.push(req.body[field]);
                    updates.push(`${field} = $${values.length}`);
                } else {
                    // BOOLEAN VALIDATION
                    if (typeof req.body[field] !== "boolean") {
                        return res.status(400).json({
                            success: false,
                            message: `${field} must be a boolean`
                        });
                    }
                    values.push(req.body[field]);
                    updates.push(`${field} = $${values.length}`);
                }

            }

        }


        // ==================================================
        // NOTHING TO UPDATE
        // ==================================================

        if (updates.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    "No valid preference fields provided"

            });

        }


        // ==================================================
        // CUSTOMER ID
        // ==================================================

        values.push(customerId);

        const customerIndex = values.length;


        // ==================================================
        // UPDATE EXISTING RECORD
        // ==================================================

        const updateQuery = `
            UPDATE notification_preferences

            SET
                ${updates.join(", ")},
                updated_at = CURRENT_TIMESTAMP

            WHERE customer_id = $${customerIndex}

            RETURNING
                id,
                customer_id,

                email_enabled,
                in_app_enabled,
                webhook_enabled,
                webhook_url,
                webhook_secret,

                notify_in_transit,
                notify_customs_hold,
                notify_delayed,
                notify_out_for_delivery,
                notify_delivered,

                created_at,
                updated_at
        `;


        const updateResult = await pool.query(
            updateQuery,
            values
        );


        // ==================================================
        // IF RECORD DOES NOT EXIST
        // ==================================================

        if (updateResult.rows.length === 0) {

            const created =
                await pool.query(
                    `
                    INSERT INTO notification_preferences (
                        customer_id,
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
                    )

                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11
                    )

                    RETURNING
                        id,
                        customer_id,

                        email_enabled,
                        in_app_enabled,
                        webhook_enabled,
                        webhook_url,
                        webhook_secret,

                        notify_in_transit,
                        notify_customs_hold,
                        notify_delayed,
                        notify_out_for_delivery,
                        notify_delivered,

                        created_at,
                        updated_at
                    `,
                    [
                        customerId,

                        req.body.email_enabled !== undefined
                            ? req.body.email_enabled
                            : DEFAULT_PREFERENCES.email_enabled,

                        req.body.in_app_enabled !== undefined
                            ? req.body.in_app_enabled
                            : DEFAULT_PREFERENCES.in_app_enabled,

                        req.body.webhook_enabled !== undefined
                            ? req.body.webhook_enabled
                            : DEFAULT_PREFERENCES.webhook_enabled,

                        req.body.webhook_url !== undefined
                            ? req.body.webhook_url
                            : DEFAULT_PREFERENCES.webhook_url,

                        req.body.webhook_secret !== undefined
                            ? req.body.webhook_secret
                            : DEFAULT_PREFERENCES.webhook_secret,

                        req.body.notify_in_transit !== undefined
                            ? req.body.notify_in_transit
                            : DEFAULT_PREFERENCES.notify_in_transit,

                        req.body.notify_customs_hold !== undefined
                            ? req.body.notify_customs_hold
                            : DEFAULT_PREFERENCES.notify_customs_hold,

                        req.body.notify_delayed !== undefined
                            ? req.body.notify_delayed
                            : DEFAULT_PREFERENCES.notify_delayed,

                        req.body.notify_out_for_delivery !== undefined
                            ? req.body.notify_out_for_delivery
                            : DEFAULT_PREFERENCES.notify_out_for_delivery,

                        req.body.notify_delivered !== undefined
                            ? req.body.notify_delivered
                            : DEFAULT_PREFERENCES.notify_delivered
                    ]
                );


            return res.status(200).json({

                success: true,

                message:
                    "Notification preferences created successfully",

                data:
                    created.rows[0]

            });

        }


        // ==================================================
        // RETURN UPDATED RECORD
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                "Notification preferences updated successfully",

            data:
                updateResult.rows[0]

        });

    } catch (error) {

        console.error(
            "Error updating notification preferences:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to update notification preferences",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

};


// ======================================================
// RESET NOTIFICATION PREFERENCES
// ======================================================
//
// PUT /api/notifications/preferences/reset
//
// ======================================================

const resetNotificationPreferences = async (
    req,
    res
) => {

    try {

        let customerId = req.user.customer_id;


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

            customerId = req.body.customer_id;

        }


        // ==================================================
        // VALIDATE CUSTOMER ID
        // ==================================================

        if (!customerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Customer ID is required"

            });

        }


        // ==================================================
        // RESET EXISTING RECORD
        // ==================================================

        const updateResult = await pool.query(
            `
            UPDATE notification_preferences

            SET
                email_enabled = TRUE,
                in_app_enabled = TRUE,
                webhook_enabled = FALSE,
                webhook_url = NULL,
                webhook_secret = NULL,

                notify_in_transit = TRUE,
                notify_customs_hold = TRUE,
                notify_delayed = TRUE,
                notify_out_for_delivery = TRUE,
                notify_delivered = TRUE,

                updated_at = CURRENT_TIMESTAMP

            WHERE customer_id = $1

            RETURNING
                id,
                customer_id,

                email_enabled,
                in_app_enabled,
                webhook_enabled,
                webhook_url,
                webhook_secret,

                notify_in_transit,
                notify_customs_hold,
                notify_delayed,
                notify_out_for_delivery,
                notify_delivered,

                created_at,
                updated_at
            `,
            [customerId]
        );


        // ==================================================
        // CREATE IF NOT FOUND
        // ==================================================

        if (updateResult.rows.length === 0) {

            const created = await pool.query(
                `
                INSERT INTO notification_preferences (
                    customer_id,
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
                )

                VALUES (
                    $1,
                    TRUE,
                    TRUE,
                    FALSE,
                    NULL,
                    NULL,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE
                )

                RETURNING
                    id,
                    customer_id,

                    email_enabled,
                    in_app_enabled,
                    webhook_enabled,
                    webhook_url,
                    webhook_secret,

                    notify_in_transit,
                    notify_customs_hold,
                    notify_delayed,
                    notify_out_for_delivery,
                    notify_delivered,

                    created_at,
                    updated_at
                `,
                [customerId]
            );


            return res.status(200).json({

                success: true,

                message:
                    "Notification preferences reset successfully",

                data:
                    created.rows[0]

            });

        }


        // ==================================================
        // RETURN RESET RECORD
        // ==================================================

        return res.status(200).json({

            success: true,

            message:
                "Notification preferences reset successfully",

            data:
                updateResult.rows[0]

        });

    } catch (error) {

        console.error(
            "Error resetting notification preferences:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to reset notification preferences",

            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getNotificationPreferences,

    updateNotificationPreferences,

    resetNotificationPreferences

};

