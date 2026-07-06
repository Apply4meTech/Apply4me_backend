const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { validateCoupon, redeemCoupon } = require('../controllers/couponController');

router.post('/validate', verifyToken, validateCoupon);
router.post('/redeem', verifyToken, redeemCoupon);

module.exports = router;
