const Job = require('../models/Job');

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

    // Build query
    const query = {
      userId: userId.toString()
    };

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by platform
    if (platform && platform !== 'all') {
      query.platform = platform;
    }

    // Search in title, company, location
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

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
      .select('title company location jobUrl platform status createdAt metadata')
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
      date: app.createdAt,
      description: app.metadata?.description,
      salary: app.metadata?.salary,
      requirements: app.metadata?.requirements || []
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
