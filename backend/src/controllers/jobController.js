const { runDelayDetectionNow } = require('../jobs/delayDetectionJob');

/**
 * POST /api/jobs/delay-detection
 * Trigger an immediate delay detection run (OPERATIONS/ADMIN only)
 */
const triggerDelayDetection = async (req, res) => {
    try {
        // Allow optional dryRun param for testing
        const dryRun = req.body && req.body.dryRun === true;

        const result = await runDelayDetectionNow({ dryRun });

        return res.status(200).json({
            success: true,
            message: 'Delay detection executed',
            data: result
        });
    } catch (err) {
        console.error('[JobController] delay detection trigger failed:', err);
        return res.status(500).json({ success: false, message: 'Failed to run delay detection', error: err.message });
    }
};

module.exports = {
    triggerDelayDetection
};
