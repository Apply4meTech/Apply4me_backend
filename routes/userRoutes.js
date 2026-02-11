const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getProfile, updateProfile, getMyPlan } = require('../controllers/userController');

// Apply authentication middleware to all routes in this router
router.use(verifyToken);

// User routes (all protected)
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.get('/my-plan', getMyPlan);

module.exports = router;
