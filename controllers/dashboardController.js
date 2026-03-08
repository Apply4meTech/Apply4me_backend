const User = require('../models/User');
const Job = require('../models/Job');
const Employee = require('../models/Employee');
const { getSignedUrl } = require('../utils/s3Service');

/**
 * Get dashboard data for user
 * GET /api/dashboard?page=1&limit=10&search=...&status=...&platform=...
 */
const getDashboardData = async (req, res) => {
  try {
    const userId = req.userId;
    const { search, status, platform, page = 1, limit = 10 } = req.query;

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

    // Build query: user ownership + optional filters
    const queryConditions = [
      {
        $or: [
          { userId: userId.toString() },
          ...(userEmail ? [{ 'userInfo.email': userEmail }] : [])
        ]
      }
    ];
    if (status && status !== 'all') {
      queryConditions.push({ status });
    }
    if (platform && platform !== 'all') {
      queryConditions.push({ platform });
    }
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      queryConditions.push({
        $or: [
          { title: searchRegex },
          { company: searchRegex },
          { location: searchRegex }
        ]
      });
    }
    const jobQuery = queryConditions.length > 1 ? { $and: queryConditions } : queryConditions[0];

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const baseUserQuery = {
      $or: [
        { userId: userId.toString() },
        ...(userEmail ? [{ 'userInfo.email': userEmail }] : [])
      ]
    };
    const total = await Job.countDocuments(jobQuery);
    const platforms = await Job.distinct('platform', baseUserQuery);

    const applications = await Job.find(jobQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('title company location jobUrl platform status createdAt userId resume coverLetter screenshotProof notes notesUpdatedAt')
      .lean();

    const buildFileInfo = async (fileObj) => {
      if (!fileObj?.key && !fileObj?.url) return null;
      let url = fileObj.url;
      if (fileObj.key) {
        try {
          url = await getSignedUrl(fileObj.key, 3600);
        } catch (err) {
          console.error('Error getting signed URL:', err);
        }
      }
      return url ? {
        url,
        fileName: fileObj.fileName,
        uploadedAt: fileObj.uploadedAt
      } : null;
    };

    const formattedApplications = await Promise.all(applications.map(async (app) => {
      const resumeToShow = app.resume?.key || app.resume?.url ? await buildFileInfo(app.resume) : null;
      const coverLetterToShow = app.coverLetter?.key || app.coverLetter?.url ? await buildFileInfo(app.coverLetter) : null;
      const screenshotToShow = app.screenshotProof?.key || app.screenshotProof?.url ? await buildFileInfo(app.screenshotProof) : null;

      return {
        id: app._id,
        jobName: app.title,
        company: app.company,
        location: app.location,
        link: app.jobUrl || null,
        status: app.status,
        source: app.platform || 'Unknown',
        date: app.createdAt,
        files: {
          resume: resumeToShow,
          coverLetter: coverLetterToShow,
          screenshotProof: screenshotToShow
        },
        notes: app.notes || '',
        notesUpdatedAt: app.notesUpdatedAt || null
      };
    }));

    res.json({
      success: true,
      data: {
        totalJobsApplied,
        accountManagerName,
        applications: formattedApplications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        },
        platforms: platforms.filter(p => p)
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
