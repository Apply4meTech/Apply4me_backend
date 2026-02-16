const express = require('express');
const router = express.Router();
const { signup, login, forgotPassword, resetPassword, verify } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Auth routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify', verifyToken, verify); // Verify token endpoint for Chrome extension

module.exports = router;
