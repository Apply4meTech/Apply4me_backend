const Plan = require('../models/Plan');
const Job = require('../models/Job');
const User = require('../models/User');

/** Statuses that count as a submitted application against the plan quota */
const QUOTA_COUNT_STATUSES = [
  'pending',
  'assigned',
  'in_progress',
  'applied',
  'response',
  'completed',
];

/**
 * Plan usage for a customer: used jobs vs plan jobApplicationsLimit (e.g. 24/100).
 */
const getPlanQuotaForUser = async (userId) => {
  if (!userId) return null;

  const user = await User.findById(userId)
    .select('subscription.planName')
    .lean();
  if (!user) return null;

  const planName = user.subscription?.planName || null;
  let limit = null;

  if (planName) {
    const plan = await Plan.findOne({ name: planName, isActive: true })
      .select('jobApplicationsLimit name')
      .lean();
    if (plan && plan.jobApplicationsLimit != null) {
      limit = plan.jobApplicationsLimit;
    }
  }

  const used = await Job.countDocuments({
    userId,
    status: { $in: QUOTA_COUNT_STATUSES },
  });

  return formatQuota(used, limit, planName);
};

const formatQuota = (used, limit, planName) => ({
  used,
  limit,
  planName: planName || null,
  display: limit != null ? `${used}/${limit}` : `${used}`,
  remaining: limit != null ? Math.max(0, limit - used) : null,
  percentUsed:
    limit != null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null,
  isAtLimit: limit != null && used >= limit,
});

const getPlanQuotaForUserIds = async (userIds) => {
  const result = {};
  if (!userIds?.length) return result;

  const ids = userIds.map((id) => id);
  const users = await User.find({ _id: { $in: ids } })
    .select('subscription.planName')
    .lean();

  const planNames = [...new Set(users.map((u) => u.subscription?.planName).filter(Boolean))];
  const plans = planNames.length
    ? await Plan.find({ name: { $in: planNames }, isActive: true })
        .select('name jobApplicationsLimit')
        .lean()
    : [];
  const limitByPlan = Object.fromEntries(
    plans.map((p) => [p.name, p.jobApplicationsLimit])
  );

  const usedCounts = await Job.aggregate([
    { $match: { userId: { $in: ids }, status: { $in: QUOTA_COUNT_STATUSES } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  const usedByUser = Object.fromEntries(
    usedCounts.map((r) => [String(r._id), r.count])
  );

  users.forEach((u) => {
    const key = String(u._id);
    const planName = u.subscription?.planName || null;
    const limit =
      planName && limitByPlan[planName] != null ? limitByPlan[planName] : null;
    const used = usedByUser[key] || 0;
    result[key] = formatQuota(used, limit, planName);
  });

  return result;
};

module.exports = {
  getPlanQuotaForUser,
  getPlanQuotaForUserIds,
  QUOTA_COUNT_STATUSES,
};
