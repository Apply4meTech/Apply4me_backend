const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getDashboardData } = require('../controllers/dashboardController');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Dashboard routes
router.get('/', getDashboardData);

module.exports = router;
