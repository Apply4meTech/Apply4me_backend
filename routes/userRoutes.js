const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/userController');

// Apply authentication middleware to all routes in this router
router.use(verifyToken);

// User routes (all protected)
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);

module.exports = router;
