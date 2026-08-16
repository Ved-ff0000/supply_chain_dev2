const pool = require("../config/database");

// ========================================
// GET CUSTOMER NOTIFICATION PREFERENCES
// ========================================

const getPreferencesByCustomer = async (customerId) => {

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

    return result.rows[0];
};


// ========================================
// CREATE DEFAULT PREFERENCES
// ========================================

const createDefaultPreferences = async (customerId) => {

    const result = await pool.query(
        `
        INSERT INTO notification_preferences (
            customer_id
        )
        VALUES ($1)

        ON CONFLICT (customer_id)
        DO UPDATE SET
            updated_at = CURRENT_TIMESTAMP

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

    return result.rows[0];
};


// ========================================
// UPDATE PREFERENCES
// ========================================

const updatePreferences = async (
    customerId,
    preferences
) => {

    const {
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
    } = preferences;


    const result = await pool.query(
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

            COALESCE($2, TRUE),
            COALESCE($3, TRUE),
            COALESCE($4, FALSE),
            $5,
            $6,

            COALESCE($7, TRUE),
            COALESCE($8, TRUE),
            COALESCE($9, TRUE),
            COALESCE($10, TRUE),
            COALESCE($11, TRUE)

        )

        ON CONFLICT (customer_id)

        DO UPDATE SET

            email_enabled =
                COALESCE(
                    EXCLUDED.email_enabled,
                    notification_preferences.email_enabled
                ),

            in_app_enabled =
                COALESCE(
                    EXCLUDED.in_app_enabled,
                    notification_preferences.in_app_enabled
                ),

            webhook_enabled =
                COALESCE(
                    EXCLUDED.webhook_enabled,
                    notification_preferences.webhook_enabled
                ),

            webhook_url =
                COALESCE(
                    EXCLUDED.webhook_url,
                    notification_preferences.webhook_url
                ),

            webhook_secret =
                COALESCE(
                    EXCLUDED.webhook_secret,
                    notification_preferences.webhook_secret
                ),

            notify_in_transit =
                COALESCE(
                    EXCLUDED.notify_in_transit,
                    notification_preferences.notify_in_transit
                ),

            notify_customs_hold =
                COALESCE(
                    EXCLUDED.notify_customs_hold,
                    notification_preferences.notify_customs_hold
                ),

            notify_delayed =
                COALESCE(
                    EXCLUDED.notify_delayed,
                    notification_preferences.notify_delayed
                ),

            notify_out_for_delivery =
                COALESCE(
                    EXCLUDED.notify_out_for_delivery,
                    notification_preferences.notify_out_for_delivery
                ),

            notify_delivered =
                COALESCE(
                    EXCLUDED.notify_delivered,
                    notification_preferences.notify_delivered
                ),

            updated_at = CURRENT_TIMESTAMP

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

            email_enabled,
            in_app_enabled,
            webhook_enabled,
            webhook_url || null,
            webhook_secret || null,

            notify_in_transit,
            notify_customs_hold,
            notify_delayed,
            notify_out_for_delivery,
            notify_delivered
        ]
    );

    return result.rows[0];
};


// ========================================
// DELETE PREFERENCES
// ========================================

const deletePreferences = async (customerId) => {

    const result = await pool.query(
        `
        DELETE FROM notification_preferences

        WHERE customer_id = $1

        RETURNING *
        `,
        [customerId]
    );

    return result.rows[0];
};


// ========================================
// EXPORT
// ========================================

module.exports = {

    getPreferencesByCustomer,

    createDefaultPreferences,

    updatePreferences,

    deletePreferences

};