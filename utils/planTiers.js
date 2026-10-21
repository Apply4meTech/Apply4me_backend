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
 * Same-plan repurchase and upgrades are allowed. Downgrades stay blocked.
 * Leftover job tokens carry into the new max on activation.
 */
function canPurchaseMainPlan(subscription, newPlanName) {
  if (!isValidMainPlan(newPlanName)) {
    return { allowed: false, isUpgrade: false, isRepurchase: false, message: 'Invalid plan' };
  }

  if (!isActiveUnexpiredSubscription(subscription)) {
    return { allowed: true, isUpgrade: false, isRepurchase: false };
  }

  const currentRank = getPlanRank(subscription.planName);
  const newRank = getPlanRank(newPlanName);

  if (newRank === currentRank) {
    return { allowed: true, isUpgrade: false, isRepurchase: true };
  }

  if (newRank < currentRank) {
    return {
      allowed: false,
      isUpgrade: false,
      isRepurchase: false,
      message: `You already have a higher plan (${subscription.planName}). Downgrades are not available.`
    };
  }

  return { allowed: true, isUpgrade: true, isRepurchase: false };
}

module.exports = {
  MAIN_PLANS,
  getPlanRank,
  isValidMainPlan,
  isActiveUnexpiredSubscription,
  canPurchaseMainPlan
};
