// ========================================
// SHIPMENT STATUS
// ========================================

const SHIPMENT_STATUS = {

    PENDING_APPROVAL: "PENDING_APPROVAL",

    CREATED: "CREATED",

    PICKED_UP: "PICKED_UP",

    IN_TRANSIT: "IN_TRANSIT",

    ARRIVED_AT_ORIGIN: "ARRIVED_AT_ORIGIN",

    DEPARTED_ORIGIN: "DEPARTED_ORIGIN",

    ARRIVED_AT_DESTINATION:
        "ARRIVED_AT_DESTINATION",

    CUSTOMS_HOLD: "CUSTOMS_HOLD",

    CUSTOMS_CLEARED:
        "CUSTOMS_CLEARED",

    OUT_FOR_DELIVERY:
        "OUT_FOR_DELIVERY",

    DELIVERED: "DELIVERED",

    DELIVERY_ATTEMPTED:
        "DELIVERY_ATTEMPTED",

    DELAYED: "DELAYED",

    LOST: "LOST",

    DAMAGED: "DAMAGED",

    CANCELLED: "CANCELLED",

    RETURNED: "RETURNED"
};


// ========================================
// SHIPMENT PRIORITY
// ========================================

const SHIPMENT_PRIORITY = {

    LOW: "LOW",

    NORMAL: "NORMAL",

    HIGH: "HIGH",

    URGENT: "URGENT"

};


// ========================================
// TERMINAL STATUSES
// ========================================

const TERMINAL_STATUSES = [

    SHIPMENT_STATUS.DELIVERED,

    SHIPMENT_STATUS.CANCELLED,

    SHIPMENT_STATUS.LOST,

    SHIPMENT_STATUS.RETURNED

];


module.exports = {

    SHIPMENT_STATUS,

    SHIPMENT_PRIORITY,

    TERMINAL_STATUSES

};