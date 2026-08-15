const {
    SHIPMENT_STATUS,
    SHIPMENT_PRIORITY
} = require("../constants/shipmentConstants");


// ========================================
// CREATE SHIPMENT VALIDATION
// ========================================

const validateCreateShipment = (
    req,
    res,
    next
) => {

    const {
        tracking_number,
        carrier_id,
        customer_id,
        origin,
        destination,
        status,
        priority
    } = req.body;


    const errors = [];


    if (!tracking_number) {

        errors.push(
            "tracking_number is required"
        );

    }


    if (!carrier_id) {

        errors.push(
            "carrier_id is required"
        );

    }


    if (!customer_id) {

        errors.push(
            "customer_id is required"
        );

    }


    if (!origin) {

        errors.push(
            "origin is required"
        );

    }


    if (!destination) {

        errors.push(
            "destination is required"
        );

    }


    if (
        status &&
        !Object.values(SHIPMENT_STATUS)
            .includes(status)
    ) {

        errors.push(
            `Invalid shipment status: ${status}`
        );

    }


    if (
        priority &&
        !Object.values(SHIPMENT_PRIORITY)
            .includes(priority)
    ) {

        errors.push(
            `Invalid shipment priority: ${priority}`
        );

    }


    if (errors.length > 0) {

        return res.status(400).json({

            success: false,

            message: "Validation failed",

            errors

        });

    }


    next();

};


// ========================================
// STATUS VALIDATION
// ========================================

const validateShipmentStatus = (
    req,
    res,
    next
) => {

    const { status } = req.body;


    if (!status) {

        return res.status(400).json({

            success: false,

            message:
                "status is required"

        });

    }


    if (
        !Object.values(SHIPMENT_STATUS)
            .includes(status)
    ) {

        return res.status(400).json({

            success: false,

            message:
                `Invalid shipment status: ${status}`

        });

    }


    next();

};


module.exports = {

    validateCreateShipment,

    validateShipmentStatus

};