const pool = require("../config/database");


// ======================================================
// GET ALL CARRIERS
// ======================================================

const getAllCarriers = async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                code,
                api_enabled,
                created_at
            FROM carriers
            ORDER BY id ASC
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
            "Error fetching carriers:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch carriers",

            error:
                error.message

        });

    }

};


// ======================================================
// GET CARRIER BY ID
// ======================================================

const getCarrierById = async (req, res) => {

    try {

        const { carrierId } = req.params;


        const result = await pool.query(
            `
            SELECT
                id,
                name,
                code,
                api_enabled,
                created_at
            FROM carriers
            WHERE id = $1
            `,
            [carrierId]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Carrier not found"

            });

        }


        return res.status(200).json({

            success: true,

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error fetching carrier:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch carrier",

            error:
                error.message

        });

    }

};


// ======================================================
// CREATE CARRIER
// ======================================================

const createCarrier = async (req, res) => {

    try {

        const {
            name,
            code,
            api_enabled
        } = req.body;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (!name || !code) {

            return res.status(400).json({

                success: false,

                message:
                    "Carrier name and code are required"

            });

        }


        const normalizedName =
            name.trim();

        const normalizedCode =
            code.trim().toUpperCase();


        // ==================================================
        // INSERT
        // ==================================================

        const result = await pool.query(
            `
            INSERT INTO carriers (
                name,
                code,
                api_enabled
            )

            VALUES (
                $1,
                $2,
                COALESCE($3, FALSE)
            )

            RETURNING
                id,
                name,
                code,
                api_enabled,
                created_at
            `,
            [
                normalizedName,
                normalizedCode,
                api_enabled ?? null
            ]
        );


        return res.status(201).json({

            success: true,

            message:
                "Carrier created successfully",

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error creating carrier:",
            error
        );


        // PostgreSQL UNIQUE violation
        if (error.code === "23505") {

            return res.status(409).json({

                success: false,

                message:
                    "Carrier name or code already exists"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Failed to create carrier",

            error:
                error.message

        });

    }

};


// ======================================================
// UPDATE CARRIER
// ======================================================

const updateCarrier = async (req, res) => {

    try {

        const { carrierId } = req.params;

        const {
            name,
            code,
            api_enabled
        } = req.body;


        // ==================================================
        // CHECK CARRIER
        // ==================================================

        const existing =
            await pool.query(
                `
                SELECT id
                FROM carriers
                WHERE id = $1
                `,
                [carrierId]
            );


        if (existing.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Carrier not found"

            });

        }


        // ==================================================
        // UPDATE
        // ==================================================

        const result = await pool.query(
            `
            UPDATE carriers

            SET
                name =
                    COALESCE($1, name),

                code =
                    COALESCE($2, code),

                api_enabled =
                    COALESCE($3, api_enabled)

            WHERE id = $4

            RETURNING
                id,
                name,
                code,
                api_enabled,
                created_at
            `,
            [
                name
                    ? name.trim()
                    : null,

                code
                    ? code.trim().toUpperCase()
                    : null,

                api_enabled ?? null,

                carrierId
            ]
        );


        return res.status(200).json({

            success: true,

            message:
                "Carrier updated successfully",

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error updating carrier:",
            error
        );


        if (error.code === "23505") {

            return res.status(409).json({

                success: false,

                message:
                    "Carrier name or code already exists"

            });

        }


        return res.status(500).json({

            success: false,

            message:
                "Failed to update carrier",

            error:
                error.message

        });

    }

};


// ======================================================
// DELETE CARRIER
// ======================================================

const deleteCarrier = async (req, res) => {

    try {

        const { carrierId } = req.params;


        // ==================================================
        // CHECK WHETHER CARRIER IS USED
        // ==================================================

        const shipmentResult =
            await pool.query(
                `
                SELECT COUNT(*) AS count
                FROM shipments
                WHERE carrier_id = $1
                `,
                [carrierId]
            );


        if (
            Number(shipmentResult.rows[0].count) > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Cannot delete carrier because shipments are associated with it"

            });

        }


        // ==================================================
        // DELETE
        // ==================================================

        const result =
            await pool.query(
                `
                DELETE FROM carriers

                WHERE id = $1

                RETURNING
                    id,
                    name,
                    code,
                    api_enabled,
                    created_at
                `,
                [carrierId]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Carrier not found"

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Carrier deleted successfully",

            data:
                result.rows[0]

        });

    } catch (error) {

        console.error(
            "Error deleting carrier:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to delete carrier",

            error:
                error.message

        });

    }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getAllCarriers,

    getCarrierById,

    createCarrier,

    updateCarrier,

    deleteCarrier

};