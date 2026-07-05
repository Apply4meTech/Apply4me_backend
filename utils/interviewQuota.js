const Interview = require('../models/Interview');
const User = require('../models/User');

const INTERVIEW_PLAN_LIMITS = {
  Pro: 1,
  Premium: 3
};

const SESSION_COUNT_STATUSES = ['in_progress', 'completed'];

/**
 * Plan includes interview prep (Pro/Premium) or user bought interview_prep add-on(s).
 */
function isInterviewEligible(user) {
  if (!user) return false;
  const plan = user.subscription?.planName;
  const addonCount = countInterviewPrepAddons(user);
  return INTERVIEW_PLAN_LIMITS[plan] > 0 || addonCount > 0;
}

function countInterviewPrepAddons(user) {
  return (user.purchasedAddons || []).filter((a) => a.name === 'interview_prep').length;
}

function getPlanInterviewLimit(planName) {
  return INTERVIEW_PLAN_LIMITS[planName] || 0;
}

function getInterviewLimitForUser(user) {
  if (!user) return 0;
  const planName = user.subscription?.planName || null;
  const planLimit = getPlanInterviewLimit(planName);
  const addonLimit = countInterviewPrepAddons(user);
  return planLimit + addonLimit;
}

/**
 * Sessions used = started or completed interviews (in_progress counts as 1 session).
 */
async function getInterviewQuotaForUser(userId) {
  const user = await User.findById(userId)
    .select('subscription.planName purchasedAddons')
    .lean();

  if (!user) return null;

  const planName = user.subscription?.planName || null;
  const planSessions = getPlanInterviewLimit(planName);
  const addonSessions = countInterviewPrepAddons(user);
  const limit = planSessions + addonSessions;
  const eligible = limit > 0;

  const used = await Interview.countDocuments({
    userId,
    status: { $in: SESSION_COUNT_STATUSES }
  });

  const remaining = Math.max(0, limit - used);

  return {
    eligible,
    planName,
    planSessions,
    addonSessions,
    limit,
    used,
    remaining,
    canStart: eligible && remaining > 0,
    display: limit > 0 ? `${used}/${limit}` : `${used}`,
    isAtLimit: limit > 0 && used >= limit
  };
}

module.exports = {
  isInterviewEligible,
  getInterviewQuotaForUser,
  getInterviewLimitForUser,
  INTERVIEW_PLAN_LIMITS,
  SESSION_COUNT_STATUSES
};
