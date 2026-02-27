const Job = require('../models/Job');
const User = require('../models/User');

/**
 * Get all applications for user with filters and pagination
 * GET /api/applications?status=applied&page=1&limit=10&search=engineer
 */
const getApplications = async (req, res) => {
  try {
    const userId = req.userId;
    const { 
      status, 
      platform, 
      search, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get user email for matching jobs by email
    const user = await User.findById(userId).select('email');
    const userEmail = user?.email?.toLowerCase();

    // Build base query to find jobs by userId OR by userInfo.email
    const baseUserQuery = {
      $or: [
        { userId: userId.toString() },
        ...(userEmail ? [{ 'userInfo.email': userEmail }] : [])
      ]
    };

    // Build query array for $and
    const queryConditions = [baseUserQuery];

    // Filter by status
    if (status && status !== 'all') {
      queryConditions.push({ status });
    }

    // Filter by platform
    if (platform && platform !== 'all') {
      queryConditions.push({ platform });
    }

    // Search in title, company, location
    if (search) {
      queryConditions.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { company: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Build final query
    const query = queryConditions.length > 1 ? { $and: queryConditions } : queryConditions[0];

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count for pagination
    const total = await Job.countDocuments(query);

    // Get applications
    const applications = await Job.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select('title company location jobUrl platform status createdAt metadata resume coverLetter screenshotProof')
      .lean();

    // Get user's resume information for applications without attached resumes
    const userResumeInfo = await User.findById(userId).select('resume_details atsReport.optimizedResumeDetails').lean();

    // Format applications
    const formattedApplications = applications.map(app => {
      // If job has a resume, use it; otherwise, use user's optimized resume (default) or original
      let resumeToShow = null;
      if (app.resume?.url) {
        resumeToShow = {
          url: app.resume.url,
          fileName: app.resume.fileName,
          uploadedAt: app.resume.uploadedAt,
          type: 'job-attached'
        };
      } else if (userResumeInfo?.atsReport?.optimizedResumeDetails?.url) {
        // Default to optimized resume if available
        resumeToShow = {
          url: userResumeInfo.atsReport.optimizedResumeDetails.url,
          fileName: userResumeInfo.atsReport.optimizedResumeDetails.fileName,
          uploadedAt: userResumeInfo.atsReport.optimizedResumeDetails.uploadedAt,
          type: 'optimized'
        };
      } else if (userResumeInfo?.resume_details?.url) {
        resumeToShow = {
          url: userResumeInfo.resume_details.url,
          fileName: userResumeInfo.resume_details.fileName,
          uploadedAt: userResumeInfo.resume_details.uploadedAt,
          type: 'original'
        };
      }

      return {
        id: app._id,
        jobName: app.title,
        company: app.company,
        location: app.location,
        link: app.jobUrl || null, // Handle optional jobUrl
        status: app.status,
        source: app.platform || 'Unknown',
        date: app.createdAt,
        description: app.metadata?.description,
        salary: app.metadata?.salary,
        requirements: app.metadata?.requirements || [],
        // Include file information
        files: {
          resume: resumeToShow,
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
      };
    });

    res.json({
      success: true,
      data: {
        applications: formattedApplications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch applications',
      details: error.message
    });
  }
};

/**
 * Get application statistics
 * GET /api/applications/stats
 */
const getApplicationStats = async (req, res) => {
  try {
    const userId = req.userId;

    const stats = await Job.aggregate([
      { $match: { userId: userId.toString() } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {
      pending: 0,
      assigned: 0,
      applied: 0,
      response: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    // Get unique platforms
    const platforms = await Job.distinct('platform', { userId: userId.toString() });

    res.json({
      success: true,
      data: {
        statusCounts,
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        platforms: platforms.filter(p => p) // Remove null/undefined
      }
    });
  } catch (error) {
    console.error('Error fetching application stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch application statistics',
      details: error.message
    });
  }
};

module.exports = {
  getApplications,
  getApplicationStats
};
