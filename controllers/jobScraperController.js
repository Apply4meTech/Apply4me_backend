const { searchJobs } = require('../services/jobScraperService');

/**
 * GET /api/employee/job-scraper/search
 * Query: jobTitle, skills, experience, location, page, country
 */
const searchExternalJobs = async (req, res) => {
  try {
    const { jobTitle, skills, experience, location, page, country } = req.query;

    const result = await searchJobs({
      jobTitle,
      skills,
      experience,
      location,
      page,
      country,
    });

    res.json({
      success: true,
      data: {
        jobs: result.jobs,
        pagination: {
          page: result.page,
          total: result.total,
          perPage: 10,
          hasMore: !!result.hasMore,
        },
        provider: result.provider,
        warning: result.warning || null,
        apiQuery: result.apiQuery || null,
        apiCountry: result.apiCountry || null,
        query: {
          jobTitle: jobTitle || '',
          skills: skills || '',
          experience: experience || '',
          location: location || '',
        },
      },
    });
  } catch (error) {
    console.error('Job scraper search error:', error);
    const status = error.statusCode || error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.message || 'Failed to search jobs',
      details: error.response?.data || undefined,
    });
  }
};

module.exports = { searchExternalJobs };
