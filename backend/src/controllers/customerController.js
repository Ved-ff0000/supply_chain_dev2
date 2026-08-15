const pool = require("../config/database");


// ======================================================
// HELPER: CHECK CUSTOMER ACCESS
// ======================================================

const canAccessCustomer = (req, customerId) => {

    const role = req.user.role;

    // OPERATIONS and ADMIN can access all customers
    if (
        role === "OPERATIONS" ||
        role === "ADMIN"
    ) {
        return true;
    }

    // CUSTOMER can access only their own customer record
    return String(req.user.customer_id) === String(customerId);
};


// ======================================================
// GET CUSTOMER BY ID
// ======================================================

const getCustomerById = async (req, res) => {

    try {

        const { customerId } = req.params;


        if (!canAccessCustomer(req, customerId)) {

            return res.status(403).json({
                success: false,
                message:
                    "You can only access your own customer profile"
            });

        }


        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                phone,
                company_name,
                created_at
            FROM customers
            WHERE id = $1
            `,
            [customerId]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });

        }


        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Error fetching customer:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch customer",
            error: error.message
        });

    }

};


// ======================================================
// UPDATE CUSTOMER
// ======================================================

const updateCustomer = async (req, res) => {

    try {

        const { customerId } = req.params;

        const {
            name,
            email,
            phone,
            company_name
        } = req.body;


        if (!canAccessCustomer(req, customerId)) {

            return res.status(403).json({
                success: false,
                message:
                    "You can only update your own customer profile"
            });

        }


        // ==================================================
        // VALIDATION
        // ==================================================

        if (
            !name &&
            !email &&
            !phone &&
            !company_name
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "At least one field is required"
            });

        }


        // ==================================================
        // CHECK CUSTOMER
        // ==================================================

        const customerResult =
            await pool.query(
                `
                SELECT id
                FROM customers
                WHERE id = $1
                `,
                [customerId]
            );


        if (customerResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });

        }


        // ==================================================
        // UPDATE
        // COALESCE keeps existing values when a field
        // isn't supplied.
        // ==================================================

        const result = await pool.query(
            `
            UPDATE customers

            SET
                name = COALESCE($1, name),
                email = COALESCE($2, email),
                phone = COALESCE($3, phone),
                company_name = COALESCE($4, company_name)

            WHERE id = $5

            RETURNING
                id,
                name,
                email,
                phone,
                company_name,
                created_at
            `,
            [
                name || null,
                email || null,
                phone || null,
                company_name || null,
                customerId
            ]
        );


        return res.status(200).json({

            success: true,

            message:
                "Customer profile updated successfully",

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error updating customer:",
            error
        );


        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                message:
                    "Email address is already in use"
            });

        }


        return res.status(500).json({
            success: false,
            message:
                "Failed to update customer",
            error: error.message
        });

    }

};


// ======================================================
// GET NOTIFICATION PREFERENCES
// ======================================================

const getNotificationPreferences = async (req, res) => {

    try {

        const { customerId } = req.params;


        if (!canAccessCustomer(req, customerId)) {

            return res.status(403).json({
                success: false,
                message:
                    "You can only access your own notification preferences"
            });

        }


        const result = await pool.query(
            `
            SELECT
                id,
                customer_id,

                email_enabled,
                in_app_enabled,
                webhook_enabled,

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
        // CREATE DEFAULT PREFERENCES IF NONE EXIST
        // ==================================================

        if (result.rows.length === 0) {

            const newPreference =
                await pool.query(
                    `
                    INSERT INTO notification_preferences (
                        customer_id
                    )

                    VALUES ($1)

                    RETURNING
                        id,
                        customer_id,

                        email_enabled,
                        in_app_enabled,
                        webhook_enabled,

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

                data:
                    newPreference.rows[0]

            });

        }


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
            error: error.message
        });

    }

};


// ======================================================
// UPDATE NOTIFICATION PREFERENCES
// ======================================================

const updateNotificationPreferences = async (req, res) => {

    try {

        const { customerId } = req.params;


        if (!canAccessCustomer(req, customerId)) {

            return res.status(403).json({
                success: false,
                message:
                    "You can only update your own notification preferences"
            });

        }


        const {
            email_enabled,
            in_app_enabled,
            webhook_enabled,

            notify_in_transit,
            notify_customs_hold,
            notify_delayed,
            notify_out_for_delivery,
            notify_delivered
        } = req.body;


        // ==================================================
        // ENSURE PREFERENCES EXIST
        // ==================================================

        await pool.query(
            `
            INSERT INTO notification_preferences (
                customer_id
            )

            VALUES ($1)

            ON CONFLICT (customer_id)
            DO NOTHING
            `,
            [customerId]
        );


        // ==================================================
        // UPDATE PREFERENCES
        // ==================================================

        const result = await pool.query(
            `
            UPDATE notification_preferences

            SET

                email_enabled =
                    COALESCE($1, email_enabled),

                in_app_enabled =
                    COALESCE($2, in_app_enabled),

                webhook_enabled =
                    COALESCE($3, webhook_enabled),

                notify_in_transit =
                    COALESCE($4, notify_in_transit),

                notify_customs_hold =
                    COALESCE($5, notify_customs_hold),

                notify_delayed =
                    COALESCE($6, notify_delayed),

                notify_out_for_delivery =
                    COALESCE($7, notify_out_for_delivery),

                notify_delivered =
                    COALESCE($8, notify_delivered),

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE customer_id = $9

            RETURNING
                id,
                customer_id,

                email_enabled,
                in_app_enabled,
                webhook_enabled,

                notify_in_transit,
                notify_customs_hold,
                notify_delayed,
                notify_out_for_delivery,
                notify_delivered,

                created_at,
                updated_at
            `,
            [
                email_enabled ?? null,
                in_app_enabled ?? null,
                webhook_enabled ?? null,

                notify_in_transit ?? null,
                notify_customs_hold ?? null,
                notify_delayed ?? null,
                notify_out_for_delivery ?? null,
                notify_delivered ?? null,

                customerId
            ]
        );


        return res.status(200).json({

            success: true,

            message:
                "Notification preferences updated successfully",

            data:
                result.rows[0]

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
                error.message

        });

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getCustomerById,

    updateCustomer,

    getNotificationPreferences,

    updateNotificationPreferences

};