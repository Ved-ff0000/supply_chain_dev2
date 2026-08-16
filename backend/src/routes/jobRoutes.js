const express = require('express');
const router = express.Router();

const { triggerDelayDetection } = require('../controllers/jobController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// POST /api/jobs/delay-detection
router.post('/delay-detection', authorizeRoles('OPERATIONS', 'ADMIN'), triggerDelayDetection);

module.exports = router;
