const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { saveOnboarding, getOnboarding } = require('../controllers/onboardingController');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Onboarding routes (files are uploaded separately via /api/upload)
router.get('/', getOnboarding);
router.post('/', saveOnboarding);

module.exports = router;
