const Coupon = require('../models/Coupon');
const Payment = require('../models/Payment');

/**
 * @param {string} code
 * @param {{ planName?: string, userId?: string }} options
 */
const findAndValidateCoupon = async (code, { planName, userId } = {}) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) {
    return { valid: false, message: 'Coupon code is required' };
  }

  const coupon = await Coupon.findOne({ code: normalized, isActive: true });
  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, message: 'This coupon has expired' };
  }

  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, message: 'This coupon has reached its usage limit' };
  }

  if (planName && coupon.applicablePlans?.length > 0 && !coupon.applicablePlans.includes(planName)) {
    return { valid: false, message: 'This coupon is not valid for the selected plan' };
  }

  if (userId) {
    const alreadyUsed = await Payment.findOne({
      userId,
      status: 'SUCCESS',
      'metadata.couponCode': coupon.code
    });
    if (alreadyUsed) {
      return { valid: false, message: 'You have already used this coupon' };
    }
  }

  return { valid: true, coupon };
};

module.exports = { findAndValidateCoupon };
