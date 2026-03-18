const Affiliate = require('../models/Affiliate');
const AffiliateCommission = require('../models/AffiliateCommission');
const User = require('../models/User');

/**
 * Create affiliate commission when a referred user completes a successful payment
 * @param {Object} payment - Payment document with userId
 * @returns {Promise<Object|null>} Commission created or null
 */
const createCommissionForReferredUser = async (payment) => {
  try {
    if (!payment?.userId) return null;
    const user = await User.findById(payment.userId).select('referredBy');
    if (!user?.referredBy) return null;

    const existing = await AffiliateCommission.findOne({ paymentId: payment._id });
    if (existing) return existing;

    const affiliate = await Affiliate.findById(user.referredBy).select('commissionRate status');
    if (!affiliate || affiliate.status !== 'active') return null;

    const rate = affiliate.commissionRate || 10;
    const amount = Math.round((payment.amount * rate) / 100 * 100) / 100;

    const commission = await AffiliateCommission.create({
      affiliateId: user.referredBy,
      userId: payment.userId,
      paymentId: payment._id,
      amount,
      status: 'pending'
    });
    return commission;
  } catch (err) {
    console.error('Affiliate commission creation error:', err);
    return null;
  }
};

module.exports = { createCommissionForReferredUser };
