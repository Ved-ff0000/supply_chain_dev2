const jwt = require("jsonwebtoken");
const pool = require("../config/database");

// ======================================================
// AUTHENTICATE TOKEN
// ======================================================

const authenticateToken = async (req, res, next) => {

    try {

        const authHeader = req.headers.authorization;

        let token = null;

        if (authHeader) {

            if (!authHeader.startsWith("Bearer ")) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid authorization format. Use Bearer <token>"
                });
            }

            token = authHeader.substring(7).trim();

        } else if (req.query && req.query.token) {

            // The browser EventSource API cannot attach custom headers, so
            // SSE subscribers pass the access token as a query parameter.
            token = String(req.query.token).trim();

        } else {

            return res.status(401).json({
                success: false,
                message: "Authorization header is required"
            });

        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const userResult = await pool.query(
            `
            SELECT
                id,
                email,
                role,
                customer_id,
                is_active
            FROM users
            WHERE id = $1
            `,
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User no longer exists"
            });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "User account is inactive"
            });
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: String(user.role).toUpperCase(),
            customer_id: user.customer_id
        };

        next();

    } catch (error) {

        console.error(
            "Authentication error:",
            error.message
        );

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Authentication token has expired"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token"
            });
        }

        return res.status(401).json({
            success: false,
            message: "Authentication failed"
        });

    }

};


// ======================================================
// AUTHORIZE ROLES
// ======================================================

const authorizeRoles = (...allowedRoles) => {

    return (req, res, next) => {

        try {

            // ------------------------------------------
            // Authentication Check
            // ------------------------------------------

            if (!req.user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Authentication required"

                });

            }


            // ------------------------------------------
            // Get User Role
            // ------------------------------------------

            const userRole =
                req.user.role;


            if (!userRole) {

                return res.status(403).json({

                    success: false,

                    message:
                        "User role not found"

                });

            }


            // ------------------------------------------
            // Normalize Roles
            // ------------------------------------------

            const normalizedUserRole =
                String(userRole).toUpperCase();


            const normalizedAllowedRoles =
                allowedRoles.map(
                    role =>
                        String(role).toUpperCase()
                );


            // ------------------------------------------
            // Check Authorization
            // ------------------------------------------

            if (
                !normalizedAllowedRoles.includes(
                    normalizedUserRole
                )
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Access denied. Insufficient permissions"

                });

            }


            // ------------------------------------------
            // Authorized
            // ------------------------------------------

            next();

        } catch (error) {

            console.error(
                "Authorization error:",
                error.message
            );

            return res.status(403).json({

                success: false,

                message:
                    "Authorization failed"

            });

        }

    };

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    authenticateToken,

    authorizeRoles

};