const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const Interview = require('../models/Interview');
const {
  buildCustomerProfileResponse,
  buildCustomerListItem,
} = require('../utils/customerProfileResponse');
const { getPlanQuotaForUserIds } = require('../utils/planQuota');
const { getInterviewQuotaForUser } = require('../utils/interviewQuota');
const { formatInterview, formatInterviewSummary } = require('../utils/interviewResponse');
const {
  getCustomerJobStatsForUserIds,
  hasSuccessfulPurchase,
  getJourneyStatus,
  getJourneyLabel,
} = require('../utils/customerJobStats');

const attachCustomerListExtras = async (users) => {
  if (!users.length) return [];
  const userIds = users.map((u) => u._id);

  const [jobStatsByUser, payments] = await Promise.all([
    getCustomerJobStatsForUserIds(userIds),
    Payment.find({ userId: { $in: userIds }, status: 'SUCCESS' })
      .sort({ completedAt: -1 })
      .select('userId completedAt')
      .lean(),
  ]);

  const paymentByUser = {};
  payments.forEach((p) => {
    const key = String(p.userId);
    if (!paymentByUser[key]) paymentByUser[key] = p.completedAt;
  });

  const planQuotaByUser = await getPlanQuotaForUserIds(userIds);

  return users.map((u) => {
    const key = String(u._id);
    const paymentCompletedAt = paymentByUser[key] || null;
    const planQuota = planQuotaByUser[key] || null;
    const stats = jobStatsByUser[key] || {
      jobsGivenByCustomer: 0,
      jobsApplied: 0,
      jobsPending: 0,
    };
    const purchased = hasSuccessfulPurchase(u, paymentCompletedAt);
    const journeyStatus = getJourneyStatus(u, paymentCompletedAt);

    return buildCustomerListItem(u, {
      ...stats,
      applicationsCount: stats.jobsGivenByCustomer,
      planQuota,
      paymentCompletedAt,
      hasPurchased: purchased,
      journeyStatus,
      journeyLabel: getJourneyLabel(journeyStatus),
      jobTokenBalance: planQuota?.remaining ?? null,
    });
  });
};

/**
 * List all customers (super admin only)
 * GET /api/employee/customers?page=&limit=&search=&onboarding=&journey=&purchase=
 */
const listCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 10, onboarding, journey, purchase } = req.query;

    const query = { role: 'user' };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { fullName: searchRegex },
        { email: searchRegex },
      ];
    }

    if (onboarding === 'complete') {
      query.isOnboardingComplete = true;
    } else if (onboarding === 'incomplete') {
      query.isOnboardingComplete = { $ne: true };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;
    const userSelect =
      'name fullName email phone phoneCode isOnboardingComplete subscription.planName subscription.status createdAt';
    const needsPostFilter = !!(journey || purchase);

    let customers;
    let total;

    if (needsPostFilter) {
      const users = await User.find(query).select(userSelect).sort({ createdAt: -1 }).lean();
      customers = await attachCustomerListExtras(users);

      if (journey) {
        customers = customers.filter((c) => c.journeyStatus === journey);
      }
      if (purchase === 'paid') {
        customers = customers.filter((c) => c.hasPurchased);
      } else if (purchase === 'unpaid') {
        customers = customers.filter((c) => !c.hasPurchased);
      }

      total = customers.length;
      customers = customers.slice(skip, skip + limitNum);
    } else {
      total = await User.countDocuments(query);
      const users = await User.find(query)
        .select(userSelect)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();
      customers = await attachCustomerListExtras(users);
    }

    res.json({
      success: true,
      customers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error listing customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
      details: error.message,
    });
  }
};

/**
 * Get customer profile (read-only) for employee/super admin
 * GET /api/employee/customers/:userId
 * Employee must have access: super_admin or has job assigned from this customer
 */
const getCustomerProfile = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    const employee = req.employee;
    const isSuperAdmin = employee.role === 'super_admin';
    const { userId: customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'Customer ID required' });
    }

    if (!isSuperAdmin) {
      const hasAccess = await Job.exists({
        userId: customerId,
        assignedTo: employeeId,
      });
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to view this customer',
        });
      }
    }

    const user = await User.findById(customerId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const profile = await buildCustomerProfileResponse(user);

    const recentJobs = await Job.find({ userId: customerId })
      .select('title company status createdAt submissionSource platform')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const { getSubmissionSourceLabel } = require('../utils/submissionSource');

    res.json({
      success: true,
      user: profile,
      recentApplications: recentJobs.map((j) => ({
        id: j._id,
        title: j.title,
        company: j.company,
        status: j.status,
        createdAt: j.createdAt,
        submissionSource: j.submissionSource,
        submissionSourceLabel: getSubmissionSourceLabel(j.submissionSource),
        platform: j.platform,
      })),
    });
  } catch (error) {
    console.error('Error fetching customer profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer profile',
      details: error.message,
    });
  }
};

const assertCustomerAccess = async (req, customerId) => {
  const employeeId = req.employeeId;
  const employee = req.employee;
  const isSuperAdmin = employee.role === 'super_admin';

  if (!customerId) {
    return { ok: false, status: 400, error: 'Customer ID required' };
  }

  if (!isSuperAdmin) {
    const hasAccess = await Job.exists({
      userId: customerId,
      assignedTo: employeeId,
    });
    if (!hasAccess) {
      return { ok: false, status: 403, error: 'You do not have access to view this customer' };
    }
  }

  const user = await User.findById(customerId).select('_id role');
  if (!user || user.role !== 'user') {
    return { ok: false, status: 404, error: 'Customer not found' };
  }

  return { ok: true, user };
};

/**
 * GET /api/employee/customers/:userId/interviews
 */
const listCustomerInterviews = async (req, res) => {
  try {
    const { userId: customerId } = req.params;
    const access = await assertCustomerAccess(req, customerId);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, error: access.error });
    }

    const [interviews, quota] = await Promise.all([
      Interview.find({ userId: customerId }).sort({ createdAt: -1 }).lean(),
      getInterviewQuotaForUser(customerId)
    ]);

    res.json({
      success: true,
      data: interviews.map(formatInterviewSummary),
      quota
    });
  } catch (error) {
    console.error('Error listing customer interviews:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer interviews' });
  }
};

/**
 * GET /api/employee/customers/:userId/interviews/:interviewId
 */
const getCustomerInterview = async (req, res) => {
  try {
    const { userId: customerId, interviewId } = req.params;
    const access = await assertCustomerAccess(req, customerId);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, error: access.error });
    }

    const interview = await Interview.findOne({ _id: interviewId, userId: customerId });
    if (!interview) {
      return res.status(404).json({ success: false, error: 'Interview not found' });
    }

    res.json({ success: true, data: formatInterview(interview) });
  } catch (error) {
    console.error('Error fetching customer interview:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch interview report' });
  }
};

module.exports = {
  listCustomers,
  getCustomerProfile,
  listCustomerInterviews,
  getCustomerInterview,
};
