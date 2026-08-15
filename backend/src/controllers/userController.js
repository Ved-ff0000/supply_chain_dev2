const bcrypt = require("bcryptjs");

const pool = require("../config/database");


// ========================================
// GET ALL USERS
// ========================================

const getAllUsers = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                id,
                name,
                email,
                role,
                is_active,
                last_login,
                created_at,
                updated_at
            FROM users
            ORDER BY id ASC
        `);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.error(
            "Error fetching users:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch users",
            error: error.message
        });
    }
};


// ========================================
// GET USER BY ID
// ========================================

const getUserById = async (req, res) => {

    try {

        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                role,
                is_active,
                last_login,
                created_at,
                updated_at
            FROM users
            WHERE id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Error fetching user:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch user",
            error: error.message
        });
    }
};


// ========================================
// UPDATE USER
// ========================================

const updateUser = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            name,
            email,
            password
        } = req.body;


        // ========================================
        // CHECK USER
        // ========================================

        const existingUser = await pool.query(
            `
            SELECT id
            FROM users
            WHERE id = $1
            `,
            [id]
        );

        if (existingUser.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        // ========================================
        // VALIDATION
        // ========================================

        if (!name && !email && !password) {

            return res.status(400).json({
                success: false,
                message:
                    "At least one field is required"
            });
        }


        // ========================================
        // UPDATE NAME / EMAIL
        // ========================================

        if (name || email) {

            const normalizedEmail =
                email
                    ? email.trim().toLowerCase()
                    : undefined;


            if (normalizedEmail) {

                const duplicate =
                    await pool.query(
                        `
                        SELECT id
                        FROM users
                        WHERE email = $1
                        AND id <> $2
                        `,
                        [
                            normalizedEmail,
                            id
                        ]
                    );


                if (duplicate.rows.length > 0) {

                    return res.status(409).json({
                        success: false,
                        message:
                            "Email is already in use"
                    });
                }
            }


            await pool.query(
                `
                UPDATE users

                SET
                    name = COALESCE($1, name),
                    email = COALESCE($2, email),
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $3
                `,
                [
                    name
                        ? name.trim()
                        : null,

                    normalizedEmail || null,

                    id
                ]
            );
        }


        // ========================================
        // UPDATE PASSWORD
        // ========================================

        if (password) {

            if (password.length < 6) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Password must contain at least 6 characters"
                });
            }


            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );


            await pool.query(
                `
                UPDATE users

                SET
                    password_hash = $1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $2
                `,
                [
                    passwordHash,
                    id
                ]
            );
        }


        // ========================================
        // GET UPDATED USER
        // ========================================

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                role,
                is_active,
                last_login,
                created_at,
                updated_at
            FROM users
            WHERE id = $1
            `,
            [id]
        );


        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Error updating user:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to update user",
            error: error.message
        });
    }
};


// ========================================
// CHANGE USER ROLE
// ========================================

const updateUserRole = async (req, res) => {

    try {

        const { id } = req.params;

        const { role } = req.body;


        const allowedRoles = [
            "ADMIN",
            "MANAGER",
            "USER"
        ];


        if (!role) {

            return res.status(400).json({
                success: false,
                message: "Role is required"
            });
        }


        const normalizedRole =
            role.toUpperCase();


        if (
            !allowedRoles.includes(
                normalizedRole
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid role",
                allowed_roles: allowedRoles
            });
        }


        const result = await pool.query(
            `
            UPDATE users

            SET
                role = $1,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $2

            RETURNING
                id,
                name,
                email,
                role,
                is_active,
                updated_at
            `,
            [
                normalizedRole,
                id
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        res.status(200).json({
            success: true,
            message:
                "User role updated successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Error updating role:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to update user role",
            error: error.message
        });
    }
};


// ========================================
// ACTIVATE / DEACTIVATE USER
// ========================================

const updateUserStatus = async (req, res) => {

    try {

        const { id } = req.params;

        const { is_active } = req.body;


        if (
            typeof is_active !== "boolean"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "is_active must be true or false"
            });
        }


        // ========================================
        // PREVENT ADMIN FROM DEACTIVATING
        // THEIR OWN ACCOUNT
        // ========================================

        if (
            Number(id) === Number(req.user.id)
            &&
            is_active === false
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "You cannot deactivate your own account"
            });
        }


        const result = await pool.query(
            `
            UPDATE users

            SET
                is_active = $1,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $2

            RETURNING
                id,
                name,
                email,
                role,
                is_active,
                updated_at
            `,
            [
                is_active,
                id
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        res.status(200).json({
            success: true,
            message:
                is_active
                    ? "User activated successfully"
                    : "User deactivated successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Error updating user status:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to update user status",
            error: error.message
        });
    }
};


// ========================================
// DELETE USER
// ========================================

const deleteUser = async (req, res) => {

    try {

        const { id } = req.params;


        // ========================================
        // PREVENT SELF DELETE
        // ========================================

        if (
            Number(id) === Number(req.user.id)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "You cannot delete your own account"
            });
        }


        const result = await pool.query(
            `
            DELETE FROM users

            WHERE id = $1

            RETURNING
                id,
                name,
                email,
                role
            `,
            [id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        res.status(200).json({
            success: true,
            message:
                "User deleted successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error(
            "Error deleting user:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to delete user",
            error: error.message
        });
    }
};


module.exports = {

    getAllUsers,

    getUserById,

    updateUser,

    updateUserRole,

    updateUserStatus,

    deleteUser

};