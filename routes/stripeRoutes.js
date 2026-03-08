const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  createStripePaymentIntent,
  verifyStripePayment,
  getStripePaymentStatus,
  checkStripeConfig,
  devFakePayment
} = require('../controllers/stripeController');

/**
 * @route GET /api/payments/stripe/config
 * @desc Check Stripe configuration
 * @access Public
 */
router.get('/config', checkStripeConfig);

/**
 * @route POST /api/payments/stripe/create-payment-intent
 * @desc Create a new Stripe payment intent
 * @access Private
 */
router.post('/create-payment-intent', verifyToken, createStripePaymentIntent);

/**
 * @route POST /api/payments/stripe/dev-fake-payment
 * @desc Dev only: Fake payment for testing full flow without Stripe
 * @access Private - only when NODE_ENV=development or ENABLE_DEV_FAKE_PAYMENT=true
 */
router.post('/dev-fake-payment', verifyToken, devFakePayment);

/**
 * @route POST /api/payments/stripe/verify
 * @desc Verify Stripe payment
 * @access Private
 */
router.post('/verify', verifyToken, verifyStripePayment);

/**
 * @route GET /api/payments/stripe/status/:paymentIntentId
 * @desc Get payment status by payment intent ID
 * @access Private
 */
router.get('/status/:paymentIntentId', verifyToken, getStripePaymentStatus);

module.exports = router;

