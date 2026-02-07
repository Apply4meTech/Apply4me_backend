const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getRazorpayPaymentStatus,
  checkRazorpayConfig
} = require('../controllers/razorpayController');

/**
 * @route GET /api/payments/razorpay/config
 * @desc Check Razorpay configuration
 * @access Public
 */
router.get('/config', checkRazorpayConfig);

/**
 * @route POST /api/payments/razorpay/create-order
 * @desc Create a new Razorpay order
 * @access Private
 */
router.post('/create-order', verifyToken, createRazorpayOrder);

/**
 * @route POST /api/payments/razorpay/verify
 * @desc Verify Razorpay payment signature
 * @access Private
 */
router.post('/verify', verifyToken, verifyRazorpayPayment);

/**
 * @route GET /api/payments/razorpay/status/:paymentId
 * @desc Get payment status by payment ID
 * @access Private
 */
router.get('/status/:paymentId', verifyToken, getRazorpayPaymentStatus);

module.exports = router;

