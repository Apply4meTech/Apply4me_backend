const Job = require('../models/Job');
const { SUBMISSION_SOURCES } = require('./submissionSource');

/** Jobs the customer submitted (extension or dashboard) */
const CUSTOMER_SUBMISSION_SOURCES = SUBMISSION_SOURCES;

const APPLIED_STATUSES = ['applied', 'response', 'rejected', 'completed'];
const PENDING_STATUSES = ['pending', 'assigned', 'in_progress'];

const hasSuccessfulPurchase = (user, paymentCompletedAt) => {
  if (paymentCompletedAt) return true;
  const sub = user?.subscription;
  return !!(sub?.planName && sub?.status === 'active');
};

const getJourneyStatus = (user, paymentCompletedAt) => {
  const onboardingDone = !!user?.isOnboardingComplete;
  const purchased = hasSuccessfulPurchase(user, paymentCompletedAt);

  if (onboardingDone && purchased) return 'converted';
  if (onboardingDone && !purchased) return 'onboarded_unpaid';
  if (!onboardingDone && purchased) return 'paid_incomplete_onboarding';
  return 'incomplete';
};

const getJourneyLabel = (status) => {
  const labels = {
    converted: 'Onboarded & purchased',
    onboarded_unpaid: 'Onboarded, no purchase',
    paid_incomplete_onboarding: 'Paid, onboarding incomplete',
    incomplete: 'Signup incomplete',
  };
  return labels[status] || status;
};

/**
 * Batch job counts per customer for admin list.
 */
const getCustomerJobStatsForUserIds = async (userIds) => {
  const result = {};
  if (!userIds?.length) return result;

  const ids = userIds.map((id) => id);
  const baseMatch = { userId: { $in: ids } };

  const [givenCounts, appliedCounts, pendingCounts] = await Promise.all([
    Job.aggregate([
      {
        $match: {
          ...baseMatch,
          $or: [
            { submissionSource: { $in: CUSTOMER_SUBMISSION_SOURCES } },
            { submissionSource: null },
            { submissionSource: { $exists: false } },
          ],
        },
      },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    Job.aggregate([
      { $match: { ...baseMatch, status: { $in: APPLIED_STATUSES } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    Job.aggregate([
      { $match: { ...baseMatch, status: { $in: PENDING_STATUSES } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
  ]);

  const toMap = (rows) =>
    Object.fromEntries(rows.map((r) => [String(r._id), r.count]));

  const givenByUser = toMap(givenCounts);
  const appliedByUser = toMap(appliedCounts);
  const pendingByUser = toMap(pendingCounts);

  ids.forEach((id) => {
    const key = String(id);
    result[key] = {
      jobsGivenByCustomer: givenByUser[key] || 0,
      jobsApplied: appliedByUser[key] || 0,
      jobsPending: pendingByUser[key] || 0,
    };
  });

  return result;
};

module.exports = {
  getCustomerJobStatsForUserIds,
  hasSuccessfulPurchase,
  getJourneyStatus,
  getJourneyLabel,
  APPLIED_STATUSES,
  PENDING_STATUSES,
};
