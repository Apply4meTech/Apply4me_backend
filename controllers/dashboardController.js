const User = require('../models/User');
const Job = require('../models/Job');
const Employee = require('../models/Employee');

/**
 * Get dashboard data for user
 * GET /api/dashboard
 */
const getDashboardData = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user to find account manager
    const user = await User.findById(userId).select('accountManagerId');
    
    // Get total jobs applied (status: 'applied', 'response', 'interview', 'rejected')
    const totalJobsApplied = await Job.countDocuments({
      userId: userId.toString(),
      status: { $in: ['applied', 'response', 'interview', 'rejected'] }
    });

    // Get account manager name
    let accountManagerName = 'Not Assigned';
    if (user && user.accountManagerId) {
      const accountManager = await Employee.findById(user.accountManagerId).select('name');
      if (accountManager) {
        accountManagerName = accountManager.name;
      }
    }

    // Get recent applications (last 10)
    const applications = await Job.find({
      userId: userId.toString()
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title company location jobUrl platform status createdAt')
      .lean();

    // Format applications
    const formattedApplications = applications.map(app => ({
      id: app._id,
      jobName: app.title,
      company: app.company,
      location: app.location,
      link: app.jobUrl,
      status: app.status,
      source: app.platform || 'Unknown',
      date: app.createdAt
    }));

    res.json({
      success: true,
      data: {
        totalJobsApplied,
        accountManagerName,
        applications: formattedApplications
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
};

module.exports = {
  getDashboardData
};
