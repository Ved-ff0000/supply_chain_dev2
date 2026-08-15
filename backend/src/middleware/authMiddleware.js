const jwt = require("jsonwebtoken");

// ======================================================
// AUTHENTICATE TOKEN
// ======================================================

const authenticateToken = (req, res, next) => {

    try {

        // ----------------------------------------------
        // Get Authorization Header
        // ----------------------------------------------

        const authHeader = req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({

                success: false,

                message:
                    "Authorization header is required"

            });

        }


        // ----------------------------------------------
        // Check Bearer Format
        // ----------------------------------------------

        if (!authHeader.startsWith("Bearer ")) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authorization format. Use Bearer <token>"

            });

        }


        // ----------------------------------------------
        // Extract Token
        // ----------------------------------------------

        const token =
            authHeader.substring(7).trim();


        if (!token) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication token is missing"

            });

        }


        // ----------------------------------------------
        // Verify JWT
        // ----------------------------------------------

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        // ----------------------------------------------
        // Store User in Request
        // ----------------------------------------------

        req.user = decoded;


        // ----------------------------------------------
        // Continue
        // ----------------------------------------------

        next();

    } catch (error) {

        console.error(
            "Authentication error:",
            error.message
        );


        // ----------------------------------------------
        // Expired Token
        // ----------------------------------------------

        if (
            error.name ===
            "TokenExpiredError"
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication token has expired"

            });

        }


        // ----------------------------------------------
        // Invalid Token
        // ----------------------------------------------

        if (
            error.name ===
            "JsonWebTokenError"
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid authentication token"

            });

        }


        // ----------------------------------------------
        // Other Authentication Error
        // ----------------------------------------------

        return res.status(401).json({

            success: false,

            message:
                "Authentication failed"

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