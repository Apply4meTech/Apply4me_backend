const MAIN_PLANS = ['Starter', 'Standard', 'Pro', 'Premium'];

function getPlanRank(planName) {
  return MAIN_PLANS.indexOf(planName);
}

function isValidMainPlan(planName) {
  return getPlanRank(planName) >= 0;
}

function isActiveUnexpiredSubscription(subscription) {
  if (!subscription?.planName || subscription.status !== 'active') return false;
  if (subscription.endDate && new Date(subscription.endDate) < new Date()) return false;
  return true;
}

/**
 * One-time packages can be upgraded to a higher tier. Same-plan repurchase
 * and downgrades stay blocked. Expired / missing plans can be purchased again.
 */
function canPurchaseMainPlan(subscription, newPlanName) {
  if (!isValidMainPlan(newPlanName)) {
    return { allowed: false, isUpgrade: false, message: 'Invalid plan' };
  }

  if (!isActiveUnexpiredSubscription(subscription)) {
    return { allowed: true, isUpgrade: false };
  }

  const currentRank = getPlanRank(subscription.planName);
  const newRank = getPlanRank(newPlanName);

  if (newRank === currentRank) {
    return {
      allowed: false,
      isUpgrade: false,
      message: `You already have an active plan (${subscription.planName}).`
    };
  }

  if (newRank < currentRank) {
    return {
      allowed: false,
      isUpgrade: false,
      message: `You already have a higher plan (${subscription.planName}). Downgrades are not available.`
    };
  }

  return { allowed: true, isUpgrade: true };
}

module.exports = {
  MAIN_PLANS,
  getPlanRank,
  isValidMainPlan,
  isActiveUnexpiredSubscription,
  canPurchaseMainPlan
};
