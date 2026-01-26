const Job = require('../models/Job');

// Create job (from Chrome extension)
const createJob = async (req, res) => {
  try {
    const { title, company, location, jobUrl, platform, metadata } = req.body;

    if (!title || !company || !jobUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: title, company, jobUrl' 
      });
    }

    // Get userId from authenticated user or from request body
    const userId = req.userId || req.body.userId || 'demo-user';

    const job = await Job.create({
      title,
      company,
      location: location || '',
      jobUrl,
      platform: platform || 'linkedin',
      metadata: metadata || {},
      userId: userId.toString()
    });

    res.status(201).json({ 
      success: true, 
      job,
      message: 'Job saved successfully'
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save job',
      details: error.message 
    });
  }
};

// Get all jobs
const getAllJobs = async (req, res) => {
  try {
    const userId = req.query.userId || 'demo-user';
    const jobs = await Job.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ 
      success: true, 
      count: jobs.length,
      jobs 
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch jobs' 
    });
  }
};

// Get single job
const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      });
    }

    res.json({ 
      success: true, 
      job 
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch job' 
    });
  }
};

// Update job status
const updateJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status is required' 
      });
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      });
    }

    res.json({ 
      success: true, 
      job 
    });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update job' 
    });
  }
};

// Delete job
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Job deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete job' 
    });
  }
};

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJobStatus,
  deleteJob
};
