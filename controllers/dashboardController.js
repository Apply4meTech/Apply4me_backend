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

    // Get user to find account manager and email
    const user = await User.findById(userId).select('accountManagerId email');
    
    // Get user email for matching jobs by email
    const userEmail = user?.email?.toLowerCase();

    // Build query to find jobs by userId OR by userInfo.email
    const statsQuery = {
      $or: [
        { userId: userId.toString() },
        ...(userEmail ? [{ 'userInfo.email': userEmail }] : [])
      ],
      status: { $in: ['applied', 'response', 'interview', 'rejected'] }
    };

    // Get total jobs applied (status: 'applied', 'response', 'interview', 'rejected')
    const totalJobsApplied = await Job.countDocuments(statsQuery);

    // Get account manager name
    let accountManagerName = 'Not Assigned';
    if (user && user.accountManagerId) {
      const accountManager = await Employee.findById(user.accountManagerId).select('name');
      if (accountManager) {
        accountManagerName = accountManager.name;
      }
    }

    // Build query to find jobs by userId OR by userInfo.email
    const jobQuery = {
      $or: [
        { userId: userId.toString() },
        ...(userEmail ? [{ 'userInfo.email': userEmail }] : [])
      ]
    };

    // Get recent applications (last 10)
    const applications = await Job.find(jobQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title company location jobUrl platform status createdAt userId resume coverLetter screenshotProof')
      .lean();

    // Format applications
    const formattedApplications = applications.map(app => ({
      id: app._id,
      jobName: app.title,
      company: app.company,
      location: app.location,
      link: app.jobUrl || null, // Handle optional jobUrl
      status: app.status,
      source: app.platform || 'Unknown',
      date: app.createdAt,
      // Include file information
      files: {
        resume: app.resume?.url ? {
          url: app.resume.url,
          fileName: app.resume.fileName,
          uploadedAt: app.resume.uploadedAt
        } : null,
        coverLetter: app.coverLetter?.url ? {
          url: app.coverLetter.url,
          fileName: app.coverLetter.fileName,
          uploadedAt: app.coverLetter.uploadedAt
        } : null,
        screenshotProof: app.screenshotProof?.url ? {
          url: app.screenshotProof.url,
          fileName: app.screenshotProof.fileName,
          uploadedAt: app.screenshotProof.uploadedAt
        } : null
      }
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
