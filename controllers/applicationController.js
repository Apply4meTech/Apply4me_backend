const Job = require('../models/Job');
const User = require('../models/User');
const { getSignedUrl } = require('../utils/s3Service');

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
      .select('title company location jobUrl platform status createdAt metadata resume coverLetter screenshotProof userId userInfo')
      .lean();

    // Format applications - only show files uploaded by employee (job-attached), use signed URLs
    const formattedApplications = await Promise.all(applications.map(async (app) => {
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
        description: app.metadata?.description,
        salary: app.metadata?.salary,
        requirements: app.metadata?.requirements || [],
        files: {
          resume: resumeToShow,
          coverLetter: coverLetterToShow,
          screenshotProof: screenshotToShow
        }
      };
    }));

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
