const mongoose = require('mongoose');
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

const CUSTOMER_PROVIDED_SOURCES = [
  'chrome_extension',
  'extension_url',
  'dashboard_url',
  'dashboard_manual',
];

const DEFAULT_PLAN_QUOTAS = {
  Starter: { total: 100, afm: 0, customer: 100 },
  Standard: { total: 175, afm: 90, customer: 85 },
  Pro: { total: 250, afm: 190, customer: 60 },
  Premium: { total: 350, afm: 350, customer: 0 },
};

const SUBSCRIPTION_LIMIT_SELECT =
  'subscription.planName subscription.jobApplicationsLimit subscription.afmJobSearchLimit subscription.customerProvidedJobLimit';

const getPlanLimits = (planName, plan = null, subscription = null) => {
  const defaults = DEFAULT_PLAN_QUOTAS[planName] || {};
  const hasSplitLimits =
    plan?.afmJobSearchLimit !== undefined ||
    plan?.customerProvidedJobLimit !== undefined;
  let total;
  let afm;
  let customer;
  if (defaults.total != null && !hasSplitLimits) {
    total = defaults.total;
    afm = defaults.afm;
    customer = defaults.customer;
  } else {
    total = plan?.jobApplicationsLimit ?? defaults.total ?? null;
    afm = plan?.afmJobSearchLimit ?? defaults.afm ?? null;
    customer = plan?.customerProvidedJobLimit ?? defaults.customer ?? null;
  }

  if (subscription?.jobApplicationsLimit != null) total = subscription.jobApplicationsLimit;
  if (subscription?.afmJobSearchLimit != null) afm = subscription.afmJobSearchLimit;
  if (subscription?.customerProvidedJobLimit != null) customer = subscription.customerProvidedJobLimit;

  return { total, afm, customer };
};

/** leftover jobs + newly purchased package. If already at cap, add a full new package on top of used. */
const nextQuotaLimit = (used, currentLimit, addedLimit) => {
  if (addedLimit == null) return currentLimit ?? null;
  const remaining = currentLimit != null ? Math.max(0, currentLimit - (used || 0)) : 0;
  let next = remaining + addedLimit;
  if ((used || 0) >= next) {
    next = (used || 0) + addedLimit;
  }
  return next;
};

const buildCarriedQuotaLimits = (currentQuota, purchasedPlanLimits) => ({
  total: nextQuotaLimit(currentQuota?.used || 0, currentQuota?.limit ?? null, purchasedPlanLimits?.total ?? null),
  afm: nextQuotaLimit(currentQuota?.afmUsed || 0, currentQuota?.afmLimit ?? null, purchasedPlanLimits?.afm ?? null),
  customer: nextQuotaLimit(
    currentQuota?.customerProvidedUsed || 0,
    currentQuota?.customerProvidedLimit ?? null,
    purchasedPlanLimits?.customer ?? null
  )
});

/**
 * Plan usage for a customer: used jobs vs plan jobApplicationsLimit (e.g. 24/100).
 */
const getPlanQuotaForUser = async (userId) => {
  if (!userId) return null;
  const userObjectId = mongoose.Types.ObjectId.isValid(String(userId))
    ? new mongoose.Types.ObjectId(String(userId))
    : userId;

  const user = await User.findById(userId)
    .select(SUBSCRIPTION_LIMIT_SELECT)
    .lean();
  if (!user) return null;

  const planName = user.subscription?.planName || null;
  let plan = null;

  if (planName) {
    plan = await Plan.findOne({ name: planName, isActive: true })
      .select('jobApplicationsLimit afmJobSearchLimit customerProvidedJobLimit name')
      .lean();
  }

  const [usage] = await Job.aggregate([
    { $match: { userId: userObjectId, status: { $in: QUOTA_COUNT_STATUSES } } },
    {
      $group: {
        _id: '$userId',
        used: { $sum: 1 },
        customerProvidedUsed: {
          $sum: {
            $cond: [{ $in: ['$submissionSource', CUSTOMER_PROVIDED_SOURCES] }, 1, 0],
          },
        },
        afmUsed: {
          $sum: {
            $cond: [{ $in: ['$submissionSource', CUSTOMER_PROVIDED_SOURCES] }, 0, 1],
          },
        },
      },
    },
  ]);

  return formatQuota(
    usage?.used || 0,
    getPlanLimits(planName, plan, user.subscription),
    planName,
    usage?.customerProvidedUsed || 0,
    usage?.afmUsed || 0
  );
};

const formatQuota = (used, limits, planName, customerProvidedUsed = 0, afmUsed = 0) => {
  const limit = limits?.total ?? null;
  const afmLimit = limits?.afm ?? null;
  const customerProvidedLimit = limits?.customer ?? null;
  return {
    used,
    limit,
    planName: planName || null,
    display: limit != null ? `${used}/${limit}` : `${used}`,
    remaining: limit != null ? Math.max(0, limit - used) : null,
    percentUsed:
      limit != null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null,
    isAtLimit: limit != null && used >= limit,
    afmUsed,
    afmLimit,
    afmRemaining: afmLimit != null ? Math.max(0, afmLimit - afmUsed) : null,
    customerProvidedUsed,
    customerProvidedLimit,
    customerProvidedRemaining:
      customerProvidedLimit != null ? Math.max(0, customerProvidedLimit - customerProvidedUsed) : null,
  };
};

const getPlanQuotaForUserIds = async (userIds) => {
  const result = {};
  if (!userIds?.length) return result;

  const ids = userIds.map((id) => id);
  const users = await User.find({ _id: { $in: ids } })
    .select(SUBSCRIPTION_LIMIT_SELECT)
    .lean();

  const planNames = [...new Set(users.map((u) => u.subscription?.planName).filter(Boolean))];
  const plans = planNames.length
    ? await Plan.find({ name: { $in: planNames }, isActive: true })
        .select('name jobApplicationsLimit afmJobSearchLimit customerProvidedJobLimit')
        .lean()
    : [];
  const planByName = Object.fromEntries(plans.map((p) => [p.name, p]));

  const usedCounts = await Job.aggregate([
    { $match: { userId: { $in: ids }, status: { $in: QUOTA_COUNT_STATUSES } } },
    {
      $group: {
        _id: '$userId',
        count: { $sum: 1 },
        customerProvidedUsed: {
          $sum: {
            $cond: [{ $in: ['$submissionSource', CUSTOMER_PROVIDED_SOURCES] }, 1, 0],
          },
        },
        afmUsed: {
          $sum: {
            $cond: [{ $in: ['$submissionSource', CUSTOMER_PROVIDED_SOURCES] }, 0, 1],
          },
        },
      },
    },
  ]);
  const usedByUser = Object.fromEntries(
    usedCounts.map((r) => [String(r._id), r])
  );

  users.forEach((u) => {
    const key = String(u._id);
    const planName = u.subscription?.planName || null;
    const usage = usedByUser[key] || {};
    result[key] = formatQuota(
      usage.count || 0,
      getPlanLimits(planName, planByName[planName], u.subscription),
      planName,
      usage.customerProvidedUsed || 0,
      usage.afmUsed || 0
    );
  });

  return result;
};

module.exports = {
  getPlanQuotaForUser,
  getPlanQuotaForUserIds,
  getPlanLimits,
  nextQuotaLimit,
  buildCarriedQuotaLimits,
  DEFAULT_PLAN_QUOTAS,
  QUOTA_COUNT_STATUSES,
  CUSTOMER_PROVIDED_SOURCES,
};
