const express = require('express');
const router = express.Router();
const { subscribe, getAllSubscriptions } = require('../controllers/newsletterController');
const { verifyEmployeeToken, requireSuperAdmin } = require('../middleware/employeeAuth');

// Public route - anyone can subscribe
router.post('/subscribe', subscribe);

// Admin route - get all subscriptions (requires super admin)
router.get('/subscriptions', verifyEmployeeToken, requireSuperAdmin, getAllSubscriptions);

module.exports = router;

