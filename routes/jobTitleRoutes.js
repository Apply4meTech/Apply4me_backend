const express = require('express');
const router = express.Router();
const { getJobTitles, addJobTitle } = require('../controllers/jobTitleController');

// Public routes - no auth required for signup/onboarding journey
router.get('/', getJobTitles);
router.post('/', addJobTitle);

module.exports = router;
