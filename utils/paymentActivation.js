const { getAddonByPlanName } = require('./addonCatalog');
const { createCommissionForReferredUser } = require('./affiliateCommission');

/**
 * Activate subscription or add-on on the user after a successful payment.
 * @param {import('../models/User')} user - Mongoose user document
 * @param {import('../models/Payment')} payment - Payment document
 */
const activatePlanOrAddonForPayment = async (user, payment) => {
  if (!payment?.planName || !user) return;

  const mainPlans = ['Starter', 'Standard', 'Pro', 'Premium'];
  const addonDef = getAddonByPlanName(payment.planName);
  const isAddon = !!addonDef;

  if (isAddon) {
    const addonName = addonDef.storageName;
    const hasAddon = user.purchasedAddons?.some((a) => a.name === addonName);
    if (!hasAddon) {
      user.purchasedAddons = user.purchasedAddons || [];
      user.purchasedAddons.push({ name: addonName, purchasedAt: new Date() });
      await user.save();
    }
  } else if (mainPlans.includes(payment.planName)) {
    let endDate = null;
    if (payment.billingPeriod === 'quarterly') {
      endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    } else if (payment.billingPeriod === 'monthly') {
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    user.subscription = {
      planName: payment.planName,
      billingPeriod: payment.billingPeriod,
      startDate: new Date(),
      endDate,
      status: 'active',
      paymentId: payment._id
    };
    await user.save();
  } else {
    console.warn('[payment] planName is not a main plan or catalog add-on:', payment.planName);
  }

  await createCommissionForReferredUser(payment);
};

module.exports = { activatePlanOrAddonForPayment };
