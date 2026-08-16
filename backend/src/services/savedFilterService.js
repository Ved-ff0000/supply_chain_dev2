/**
 * Saved shipment filters (Feature 7).
 *
 * Filters are per-user. Only the keys the shipment list actually understands
 * are persisted, so a saved preset can never smuggle arbitrary SQL-shaped
 * input back into the query builder.
 */

const pool = require("../config/database");

const ALLOWED_FILTER_KEYS = [
    "status",
    "priority",
    "carrier_id",
    "customer_id",
    "search"
];

/**
 * Keep only recognised keys with non-empty values.
 */
const sanitizeFilter = (filter) => {
    const source = filter && typeof filter === "object" ? filter : {};
    const clean = {};

    for (const key of ALLOWED_FILTER_KEYS) {
        const value = source[key];

        if (value === undefined || value === null || value === "") {
            continue;
        }

        if (key === "carrier_id" || key === "customer_id") {
            const numeric = Number(value);

            if (Number.isInteger(numeric) && numeric > 0) {
                clean[key] = numeric;
            }

            continue;
        }

        clean[key] = String(value).slice(0, 200);
    }

    return clean;
};

const listFilters = async (userId) => {
    const result = await pool.query(
        `
        SELECT id, name, filter_json, is_default, created_at, updated_at
        FROM saved_shipment_filters
        WHERE user_id = $1
        ORDER BY is_default DESC, name ASC
        `,
        [Number(userId)]
    );

    return result.rows;
};

const getFilter = async ({ id, userId }) => {
    const result = await pool.query(
        `
        SELECT id, name, filter_json, is_default, created_at, updated_at
        FROM saved_shipment_filters
        WHERE id = $1 AND user_id = $2
        `,
        [Number(id), Number(userId)]
    );

    return result.rows[0] || null;
};

/**
 * Only one preset per user may be the default; clearing is done in the same
 * transaction as the write so the invariant always holds.
 */
const clearOtherDefaults = async (client, userId, exceptId = null) => {
    const values = [Number(userId)];
    let exceptClause = "";

    if (exceptId) {
        values.push(Number(exceptId));
        exceptClause = ` AND id <> $${values.length}`;
    }

    await client.query(
        `
        UPDATE saved_shipment_filters
        SET is_default = FALSE
        WHERE user_id = $1 AND is_default = TRUE ${exceptClause}
        `,
        values
    );
};

const createFilter = async ({ userId, name, filter, isDefault = false }) => {
    const trimmedName = String(name || "").trim();

    if (!trimmedName) {
        const error = new Error("Filter name is required");
        error.statusCode = 400;
        throw error;
    }

    const cleanFilter = sanitizeFilter(filter);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        if (isDefault) {
            await clearOtherDefaults(client, userId);
        }

        const result = await client.query(
            `
            INSERT INTO saved_shipment_filters (
                user_id, name, filter_json, is_default
            )
            VALUES ($1, $2, $3::jsonb, $4)
            RETURNING id, name, filter_json, is_default, created_at, updated_at
            `,
            [
                Number(userId),
                trimmedName.slice(0, 255),
                JSON.stringify(cleanFilter),
                Boolean(isDefault)
            ]
        );

        await client.query("COMMIT");

        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            const conflict = new Error(
                "A filter with that name already exists"
            );
            conflict.statusCode = 409;
            throw conflict;
        }

        throw error;
    } finally {
        client.release();
    }
};

const updateFilter = async ({ id, userId, name, filter, isDefault }) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        if (isDefault === true) {
            await clearOtherDefaults(client, userId, id);
        }

        const cleanFilter =
            filter === undefined ? null : JSON.stringify(sanitizeFilter(filter));

        const result = await client.query(
            `
            UPDATE saved_shipment_filters
            SET
                name = COALESCE($1::varchar, name),
                filter_json = COALESCE($2::jsonb, filter_json),
                is_default = COALESCE($3::boolean, is_default),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4 AND user_id = $5
            RETURNING id, name, filter_json, is_default, created_at, updated_at
            `,
            [
                name === undefined ? null : String(name).trim().slice(0, 255),
                cleanFilter,
                isDefault === undefined ? null : Boolean(isDefault),
                Number(id),
                Number(userId)
            ]
        );

        await client.query("COMMIT");

        return result.rows[0] || null;
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            const conflict = new Error(
                "A filter with that name already exists"
            );
            conflict.statusCode = 409;
            throw conflict;
        }

        throw error;
    } finally {
        client.release();
    }
};

const deleteFilter = async ({ id, userId }) => {
    const result = await pool.query(
        `
        DELETE FROM saved_shipment_filters
        WHERE id = $1 AND user_id = $2
        RETURNING id, name
        `,
        [Number(id), Number(userId)]
    );

    return result.rows[0] || null;
};

module.exports = {
    ALLOWED_FILTER_KEYS,
    sanitizeFilter,
    listFilters,
    getFilter,
    createFilter,
    updateFilter,
    deleteFilter
};
