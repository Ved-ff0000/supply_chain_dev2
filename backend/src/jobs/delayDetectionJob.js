const { checkAndFlagDelayedShipments } = require("../services/delayDetectionService");

let cron = null;
try {
    cron = require("node-cron");
} catch (err) {
    console.warn("[Cron] node-cron package not found, fallback interval scheduler will be used.");
}

let activeCronTask = null;
let fallbackInterval = null;

/**
 * Schedule pattern: default is every 15 minutes: * /15 * * * *
 */
const CRON_SCHEDULE = process.env.DELAY_DETECTION_CRON || "*/15 * * * *";

/**
 * Execute a single delay detection run with logging and error isolation.
 */
const runDelayDetectionNow = async (options = {}) => {
    console.log(`[DelayDetectionJob] Starting automated delay detection check at ${new Date().toISOString()}...`);
    try {
        const result = await checkAndFlagDelayedShipments(options);
        console.log(
            `[DelayDetectionJob] Completed: Scanned ${result.total_scanned} shipments, auto-delayed ${result.delayed_count} shipments.`
        );
        return result;
    } catch (error) {
        console.error("[DelayDetectionJob] Execution failed:", error);
        throw error;
    }
};

/**
 * Start the scheduled background delay detection job.
 */
const startDelayDetectionJob = () => {
    // If already running, do nothing
    if (activeCronTask || fallbackInterval) {
        console.log("[DelayDetectionJob] Job is already running.");
        return;
    }

    if (cron && cron.schedule) {
        console.log(`[DelayDetectionJob] Scheduling delay detection job with cron pattern: "${CRON_SCHEDULE}"`);
        activeCronTask = cron.schedule(CRON_SCHEDULE, async () => {
            await runDelayDetectionNow();
        });
    } else {
        // Fallback to 15-minute interval (900,000 ms)
        const intervalMs = 15 * 60 * 1000;
        console.log(`[DelayDetectionJob] Starting fallback interval runner (every ${intervalMs / 1000}s)`);
        fallbackInterval = setInterval(async () => {
            await runDelayDetectionNow();
        }, intervalMs);
    }
};

/**
 * Stop the background delay detection job (for graceful shutdown or testing).
 */
const stopDelayDetectionJob = () => {
    if (activeCronTask) {
        activeCronTask.stop();
        activeCronTask = null;
        console.log("[DelayDetectionJob] Cron task stopped.");
    }
    if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
        console.log("[DelayDetectionJob] Fallback interval cleared.");
    }
};

module.exports = {
    startDelayDetectionJob,
    stopDelayDetectionJob,
    runDelayDetectionNow
};
