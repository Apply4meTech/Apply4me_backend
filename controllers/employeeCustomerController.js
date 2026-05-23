const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');
const {
  buildCustomerProfileResponse,
  buildCustomerListItem,
} = require('../utils/customerProfileResponse');
const { getPlanQuotaForUserIds } = require('../utils/planQuota');

const attachCustomerListExtras = async (users) => {
  if (!users.length) return [];
  const userIds = users.map((u) => u._id);

  const [appCounts, payments] = await Promise.all([
    Job.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    Payment.find({ userId: { $in: userIds }, status: 'SUCCESS' })
      .sort({ completedAt: -1 })
      .select('userId completedAt')
      .lean(),
  ]);

  const countByUser = Object.fromEntries(appCounts.map((r) => [String(r._id), r.count]));
  const paymentByUser = {};
  payments.forEach((p) => {
    const key = String(p.userId);
    if (!paymentByUser[key]) paymentByUser[key] = p.completedAt;
  });

  const planQuotaByUser = await getPlanQuotaForUserIds(userIds);

  return users.map((u) =>
    buildCustomerListItem(u, {
      applicationsCount: countByUser[String(u._id)] || 0,
      planQuota: planQuotaByUser[String(u._id)] || null,
      paymentCompletedAt: paymentByUser[String(u._id)] || null,
    })
  );
};

/**
 * List all customers (super admin only)
 * GET /api/employee/customers?page=&limit=&search=&onboarding=
 */
const listCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 10, onboarding } = req.query;

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

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select(
        'name fullName email phone phoneCode isOnboardingComplete subscription.planName subscription.status createdAt'
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const customers = await attachCustomerListExtras(users);

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

module.exports = {
  listCustomers,
  getCustomerProfile,
};
