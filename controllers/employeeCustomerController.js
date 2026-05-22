const User = require('../models/User');
const Job = require('../models/Job');
const {
  buildCustomerProfileResponse,
  buildCustomerListItem,
} = require('../utils/customerProfileResponse');

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

    res.json({
      success: true,
      customers: users.map(buildCustomerListItem),
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

    res.json({
      success: true,
      user: profile,
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
