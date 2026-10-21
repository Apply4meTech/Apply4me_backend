const Plan = require('../models/Plan');
const { getAddonByPlanName } = require('./addonCatalog');
const { createCommissionForReferredUser } = require('./affiliateCommission');
const { MAIN_PLANS } = require('./planTiers');
const { getPlanQuotaForUser, getPlanLimits, buildCarriedQuotaLimits } = require('./planQuota');

/**
 * Activate subscription or add-on on the user after a successful payment.
 * Buying the same/higher plan keeps leftover jobs and adds the new package to the max.
 * @param {import('../models/User')} user - Mongoose user document
 * @param {import('../models/Payment')} payment - Payment document
 */
const activatePlanOrAddonForPayment = async (user, payment) => {
  if (!payment?.planName || !user) return;

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
  } else if (MAIN_PLANS.includes(payment.planName)) {
    let endDate = null;
    if (payment.billingPeriod === 'quarterly') {
      endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    } else if (payment.billingPeriod === 'monthly') {
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const purchasedPlan = await Plan.findOne({ name: payment.planName, isActive: true })
      .select('jobApplicationsLimit afmJobSearchLimit customerProvidedJobLimit name')
      .lean();
    const purchasedLimits = getPlanLimits(payment.planName, purchasedPlan);
    const currentQuota = await getPlanQuotaForUser(user._id);
    const carried = buildCarriedQuotaLimits(currentQuota, purchasedLimits);

    user.subscription = {
      planName: payment.planName,
      billingPeriod: payment.billingPeriod,
      startDate: new Date(),
      endDate,
      status: 'active',
      paymentId: payment._id,
      jobApplicationsLimit: carried.total,
      afmJobSearchLimit: carried.afm,
      customerProvidedJobLimit: carried.customer
    };
    await user.save();
  } else {
    console.warn('[payment] planName is not a main plan or catalog add-on:', payment.planName);
  }

  await createCommissionForReferredUser(payment);
};

module.exports = { activatePlanOrAddonForPayment };
