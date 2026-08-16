const pool = require("../config/database");
const { predictShipmentETA } = require("../services/etaPredictionService");

/**
 * GET /api/shipments/:id/eta
 * Retrieves estimated time of arrival (ETA) and delay risk analysis for a specific shipment.
 */
const getShipmentETA = async (req, res) => {
    try {
        const { id } = req.params;
        const shipmentId = Number(id);

        if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid shipment ID"
            });
        }

        // Ownership verification for CUSTOMER role
        const userRole = String(req.user?.role || "").toUpperCase();
        if (userRole === "CUSTOMER") {
            const customerCheck = await pool.query(
                `SELECT customer_id FROM shipments WHERE id = $1`,
                [shipmentId]
            );

            if (customerCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Shipment not found"
                });
            }

            if (Number(customerCheck.rows[0].customer_id) !== Number(req.user.customer_id)) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. You can only view ETA for your own shipments"
                });
            }
        }

        const prediction = await predictShipmentETA(shipmentId);

        return res.status(200).json({
            success: true,
            message: "Shipment ETA prediction computed successfully",
            data: prediction
        });
    } catch (error) {
        console.error("Error predicting shipment ETA:", error);

        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to calculate shipment ETA",
            error: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
    }
};

module.exports = {
    getShipmentETA
};
