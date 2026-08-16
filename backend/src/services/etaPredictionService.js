const pool = require("../config/database");

/**
 * Base interface / contract for ETA Prediction Models.
 * Allows swapping the statistical heuristic with an ML / regression microservice in the future.
 */
class BaseEtaPredictionModel {
    async predict(shipment) {
        throw new Error("predict() must be implemented by subclass");
    }
}

/**
 * Historical Average Transit Time Prediction Model.
 * Computes average historical transit times across tiered granularities:
 *   Tier 1: Carrier + Origin + Destination (exact route)
 *   Tier 2: Carrier + Priority
 *   Tier 3: Carrier overall
 *   Tier 4: Global default fallback
 */
class HistoricalAverageEtaModel extends BaseEtaPredictionModel {
    /**
     * Compute average transit time from completed (DELIVERED) shipments.
     * Transit time is calculated between initial shipment creation / pickup and delivery.
     */
    async predict(shipment) {
        const {
            id: shipmentId,
            tracking_number,
            carrier_id,
            carrier_name,
            origin,
            destination,
            priority,
            status,
            expected_delivery,
            created_at
        } = shipment;

        // Base start time for transit calculation: created_at or earliest event
        const startTime = new Date(created_at || Date.now());

        // ----------------------------------------------------
        // TIER 1: Match Carrier + Exact Route (Origin, Destination)
        // ----------------------------------------------------
        const routeQuery = await pool.query(
            `
            SELECT 
                COUNT(s.id) AS sample_size,
                AVG(EXTRACT(EPOCH FROM (COALESCE(s.actual_delivery, e.event_time) - s.created_at)) / 3600.0) AS avg_hours
            FROM shipments s
            LEFT JOIN (
                SELECT shipment_id, MAX(event_time) AS event_time
                FROM shipment_events
                WHERE status = 'DELIVERED'
                GROUP BY shipment_id
            ) e ON s.id = e.shipment_id
            WHERE s.carrier_id = $1
              AND LOWER(TRIM(s.origin)) = LOWER(TRIM($2))
              AND LOWER(TRIM(s.destination)) = LOWER(TRIM($3))
              AND (s.status = 'DELIVERED' OR s.actual_delivery IS NOT NULL)
              AND (s.actual_delivery > s.created_at OR e.event_time > s.created_at)
            `,
            [carrier_id, origin, destination]
        );

        const routeRow = routeQuery.rows[0];
        const routeSampleSize = parseInt(routeRow?.sample_size || 0, 10);
        const routeAvgHours = parseFloat(routeRow?.avg_hours);

        if (routeSampleSize >= 3 && !isNaN(routeAvgHours) && routeAvgHours > 0) {
            return this.buildPredictionResult(
                shipment,
                startTime,
                routeAvgHours,
                "CARRIER_ROUTE_HISTORICAL_AVG",
                routeSampleSize,
                0.90
            );
        }

        // ----------------------------------------------------
        // TIER 2: Fallback to Carrier + Priority
        // ----------------------------------------------------
        const priorityQuery = await pool.query(
            `
            SELECT 
                COUNT(s.id) AS sample_size,
                AVG(EXTRACT(EPOCH FROM (COALESCE(s.actual_delivery, e.event_time) - s.created_at)) / 3600.0) AS avg_hours
            FROM shipments s
            LEFT JOIN (
                SELECT shipment_id, MAX(event_time) AS event_time
                FROM shipment_events
                WHERE status = 'DELIVERED'
                GROUP BY shipment_id
            ) e ON s.id = e.shipment_id
            WHERE s.carrier_id = $1
              AND UPPER(s.priority) = UPPER($2)
              AND (s.status = 'DELIVERED' OR s.actual_delivery IS NOT NULL)
              AND (s.actual_delivery > s.created_at OR e.event_time > s.created_at)
            `,
            [carrier_id, priority]
        );

        const priorityRow = priorityQuery.rows[0];
        const prioritySampleSize = parseInt(priorityRow?.sample_size || 0, 10);
        const priorityAvgHours = parseFloat(priorityRow?.avg_hours);

        if (prioritySampleSize >= 2 && !isNaN(priorityAvgHours) && priorityAvgHours > 0) {
            return this.buildPredictionResult(
                shipment,
                startTime,
                priorityAvgHours,
                "CARRIER_PRIORITY_HISTORICAL_AVG",
                prioritySampleSize,
                0.75
            );
        }

        // ----------------------------------------------------
        // TIER 3: Fallback to Overall Carrier Average
        // ----------------------------------------------------
        const carrierQuery = await pool.query(
            `
            SELECT 
                COUNT(s.id) AS sample_size,
                AVG(EXTRACT(EPOCH FROM (COALESCE(s.actual_delivery, e.event_time) - s.created_at)) / 3600.0) AS avg_hours
            FROM shipments s
            LEFT JOIN (
                SELECT shipment_id, MAX(event_time) AS event_time
                FROM shipment_events
                WHERE status = 'DELIVERED'
                GROUP BY shipment_id
            ) e ON s.id = e.shipment_id
            WHERE s.carrier_id = $1
              AND (s.status = 'DELIVERED' OR s.actual_delivery IS NOT NULL)
              AND (s.actual_delivery > s.created_at OR e.event_time > s.created_at)
            `,
            [carrier_id]
        );

        const carrierRow = carrierQuery.rows[0];
        const carrierSampleSize = parseInt(carrierRow?.sample_size || 0, 10);
        const carrierAvgHours = parseFloat(carrierRow?.avg_hours);

        if (carrierSampleSize >= 1 && !isNaN(carrierAvgHours) && carrierAvgHours > 0) {
            return this.buildPredictionResult(
                shipment,
                startTime,
                carrierAvgHours,
                "CARRIER_OVERALL_HISTORICAL_AVG",
                carrierSampleSize,
                0.60
            );
        }

        // ----------------------------------------------------
        // TIER 4: Global Baseline Default (based on priority)
        // ----------------------------------------------------
        const defaultHoursByPriority = {
            URGENT: 24,
            HIGH: 48,
            NORMAL: 72,
            LOW: 120
        };

        const defaultHours = defaultHoursByPriority[String(priority).toUpperCase()] || 72;

        return this.buildPredictionResult(
            shipment,
            startTime,
            defaultHours,
            "SYSTEM_BASELINE_DEFAULT",
            0,
            0.40
        );
    }

    buildPredictionResult(shipment, startTime, avgTransitHours, strategy, sampleSize, baseConfidence) {
        const roundedHours = Math.round(avgTransitHours * 10) / 10;
        const predictedEtaDate = new Date(startTime.getTime() + roundedHours * 3600 * 1000);
        const expectedDeliveryDate = shipment.expected_delivery ? new Date(shipment.expected_delivery) : null;
        const now = new Date();

        // Determine delay risk
        let delayRisk = "LOW";
        if (shipment.status === "DELIVERED") {
            delayRisk = "NONE";
        } else if (shipment.status === "DELAYED") {
            delayRisk = "CRITICAL";
        } else if (expectedDeliveryDate) {
            if (now > expectedDeliveryDate || predictedEtaDate > expectedDeliveryDate) {
                delayRisk = "HIGH";
            } else {
                // Check if buffer is less than 6 hours
                const diffHours = (expectedDeliveryDate.getTime() - predictedEtaDate.getTime()) / (3600 * 1000);
                if (diffHours < 6) {
                    delayRisk = "MEDIUM";
                }
            }
        }

        return {
            shipment_id: shipment.id,
            tracking_number: shipment.tracking_number,
            status: shipment.status,
            priority: shipment.priority,
            carrier: {
                id: shipment.carrier_id,
                name: shipment.carrier_name || shipment.carrier || null,
                code: shipment.carrier_code || null
            },
            route: {
                origin: shipment.origin,
                destination: shipment.destination
            },
            expected_delivery: shipment.expected_delivery || null,
            predicted_eta: predictedEtaDate.toISOString(),
            actual_delivery: shipment.actual_delivery || null,
            delay_risk: delayRisk,
            model_metadata: {
                model_type: "HISTORICAL_AVERAGE_TRANSIT",
                strategy,
                sample_size: sampleSize,
                avg_transit_hours: roundedHours,
                confidence_score: baseConfidence
            }
        };
    }
}

// Instantiate active prediction model (can be replaced with ML model adapter)
const defaultModel = new HistoricalAverageEtaModel();

/**
 * Public service method to predict ETA for a shipment by ID
 */
const predictShipmentETA = async (shipmentId, customModel = defaultModel) => {
    const numericId = Number(shipmentId);
    if (!numericId || numericId <= 0) {
        const error = new Error("Invalid shipment ID");
        error.statusCode = 400;
        throw error;
    }

    const shipmentResult = await pool.query(
        `
        SELECT 
            s.id,
            s.tracking_number,
            s.customer_id,
            s.carrier_id,
            ca.name AS carrier_name,
            ca.code AS carrier_code,
            s.origin,
            s.destination,
            s.status,
            s.priority,
            s.expected_delivery,
            s.actual_delivery,
            s.created_at,
            s.updated_at
        FROM shipments s
        JOIN carriers ca ON s.carrier_id = ca.id
        WHERE s.id = $1
        `,
        [numericId]
    );

    if (shipmentResult.rows.length === 0) {
        const error = new Error("Shipment not found");
        error.statusCode = 404;
        throw error;
    }

    const shipment = shipmentResult.rows[0];
    return customModel.predict(shipment);
};

module.exports = {
    BaseEtaPredictionModel,
    HistoricalAverageEtaModel,
    predictShipmentETA
};
