const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getApplications, getApplicationStats } = require('../controllers/applicationController');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Application routes
router.get('/', getApplications);
router.get('/stats', getApplicationStats);

module.exports = router;
