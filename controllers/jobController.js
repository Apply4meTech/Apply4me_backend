const Job = require('../models/Job');
const User = require('../models/User');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');
const { detectPlatformFromUrl } = require('../utils/platformDetector');
const { autoAssignJob } = require('../utils/autoAssign');

// Create job (from Chrome extension, manual URL submission, or custom job)
const createJob = async (req, res) => {
  try {
    const { title, company, location, jobUrl, platform, metadata, userId: bodyUserId } = req.body;

    // Validate required fields - jobUrl is now optional for custom jobs
    // For Indeed platform, company can be empty string
    const detectedPlatform = platform || (jobUrl ? detectPlatformFromUrl(jobUrl) : 'custom');
    const isIndeed = detectedPlatform === 'indeed';
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: title is required' 
      });
    }
    
    // Company is required except for Indeed platform
    if (!isIndeed && (!company || company.trim() === '')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: company is required' 
      });
    }

    // Get userId from authenticated user (from optionalAuth middleware) or from request body
    // Priority: req.userId (from token) > bodyUserId > try to match by email > null
    let userId = req.userId || bodyUserId || null;
    
    // If userId is "demo-user" or not a valid ObjectId, set to null
    if (userId === 'demo-user' || userId === '') {
      userId = null;
    } else if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      // If it's not a valid ObjectId, set to null
      userId = null;
    }

    const userInfo = req.body.userInfo || {};
    
    // Clean up userInfo - remove empty strings and ensure proper structure
    const cleanedUserInfo = {
      name: (userInfo.name || '').trim() || undefined,
      profileUrl: (userInfo.profileUrl || '').trim() || undefined,
      email: (userInfo.email || '').trim() || undefined,
      phone: (userInfo.phone || '').trim() || undefined
    };
    
    // Remove undefined fields (MongoDB will handle empty strings, but undefined is cleaner)
    Object.keys(cleanedUserInfo).forEach(key => {
      if (cleanedUserInfo[key] === undefined || cleanedUserInfo[key] === '') {
        delete cleanedUserInfo[key];
      }
    });

    // If userId is still null but we have an email in userInfo, try to find user by email
    if (!userId && cleanedUserInfo.email) {
      try {
        const userByEmail = await User.findOne({ email: cleanedUserInfo.email.toLowerCase() });
        if (userByEmail) {
          userId = userByEmail._id;
          console.log(`🔗 Linked job to user by email: ${cleanedUserInfo.email}`);
        }
      } catch (emailError) {
        console.error('Error finding user by email:', emailError);
        // Continue without userId if lookup fails
      }
    }

    // If userId is still null but req.user exists (from token), use it
    if (!userId && req.user && req.user._id) {
      userId = req.user._id;
      console.log(`🔗 Using userId from authenticated user: ${userId}`);
    }
    
    // Use the detected platform (already detected above for validation)
    const finalPlatform = detectedPlatform;

    // Log user info for tracking
    console.log('👤 Job creation request:', {
      userId: userId || 'null',
      name: cleanedUserInfo.name || 'N/A',
      profileUrl: cleanedUserInfo.profileUrl || 'N/A',
      email: cleanedUserInfo.email || 'N/A',
      phone: cleanedUserInfo.phone || 'N/A',
      jobTitle: title,
      company: isIndeed ? '(empty for Indeed)' : company,
      location: location || 'N/A',
      platform: finalPlatform,
      hasUrl: !!jobUrl,
      hasToken: !!req.userId,
      rawUserInfo: userInfo
    });

    const job = await Job.create({
      title,
      company: isIndeed ? '' : (company || ''), // Empty string for Indeed, otherwise use provided company (with fallback)
      location: location || '',
      jobUrl: jobUrl || undefined, // Only include if provided
      platform: finalPlatform,
      metadata: metadata || {},
      userId: userId || null,
      userInfo: Object.keys(cleanedUserInfo).length > 0 ? cleanedUserInfo : {}
    });
    
    console.log('✅ Job created:', {
      id: job._id,
      title: job.title,
      company: job.company,
      platform: job.platform,
      userId: job.userId || 'null',
      hasUrl: !!job.jobUrl
    });

    // Auto-assign job if enabled
    let assignedEmployee = null;
    try {
      const settings = await Settings.getSettings();
      if (settings.autoAssignEnabled) {
        const assignmentResult = await autoAssignJob(job._id);
        if (assignmentResult) {
          assignedEmployee = assignmentResult.employee;
          // Refresh job to get updated assignment info
          const updatedJob = await Job.findById(job._id)
            .populate('assignedTo', 'name email')
            .lean();
          
          return res.status(201).json({ 
            success: true, 
            job: updatedJob,
            message: 'Job saved and auto-assigned successfully',
            autoAssigned: true,
            assignedTo: {
              id: assignedEmployee._id,
              name: assignedEmployee.name,
              email: assignedEmployee.email
            }
          });
        }
      }
    } catch (autoAssignError) {
      console.error('Error in auto-assignment:', autoAssignError);
      // Continue with normal response even if auto-assign fails
    }

    res.status(201).json({ 
      success: true, 
      job,
      message: 'Job saved successfully',
      autoAssigned: false
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
    let userId = req.query.userId || 'demo-user';
    
    // Handle "demo-user" by querying for null userId
    if (userId === 'demo-user' || userId === '') {
      userId = null;
    } else if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      // If it's not a valid ObjectId, treat as demo
      userId = null;
    }
    
    // Build query - if userId is null, find jobs with null userId
    const query = userId ? { userId } : { userId: null };
    
    const jobs = await Job.find(query)
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

// Get jobs by user email or phone
const getJobsByUserInfo = async (req, res) => {
  try {
    const { email, phone } = req.query;
    
    if (!email && !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide email or phone query parameter' 
      });
    }
    
    const query = {};
    if (email) {
      query['userInfo.email'] = email;
    }
    if (phone) {
      query['userInfo.phone'] = phone;
    }
    
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ 
      success: true, 
      count: jobs.length,
      jobs 
    });
  } catch (error) {
    console.error('Error fetching jobs by user info:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch jobs' 
    });
  }
};

// Get all unique users (email/phone combinations)
const getAllUsers = async (req, res) => {
  try {
    const jobs = await Job.find({
      $or: [
        { 'userInfo.email': { $exists: true, $ne: '' } },
        { 'userInfo.phone': { $exists: true, $ne: '' } }
      ]
    }).select('userInfo createdAt');
    
    // Extract unique users
    const usersMap = new Map();
    jobs.forEach(job => {
      if (job.userInfo && (job.userInfo.email || job.userInfo.phone)) {
        const key = `${job.userInfo.email || ''}_${job.userInfo.phone || ''}`;
        if (!usersMap.has(key)) {
          usersMap.set(key, {
            email: job.userInfo.email || null,
            phone: job.userInfo.phone || null,
            firstSeen: job.createdAt,
            jobCount: 0
          });
        }
        usersMap.get(key).jobCount++;
      }
    });
    
    const users = Array.from(usersMap.values());
    
    res.json({ 
      success: true, 
      count: users.length,
      users 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users' 
    });
  }
};

// Update job notes (for users)
const updateJobNotes = async (req, res) => {
  try {
    const { notes } = req.body;
    const userId = req.userId;
    const jobId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Find job and verify ownership
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Check if user owns this job
    const userEmail = req.user?.email?.toLowerCase();
    const jobUserId = job.userId?.toString();
    const jobUserEmail = job.userInfo?.email?.toLowerCase();

    if (jobUserId !== userId.toString() && 
        (!userEmail || jobUserEmail !== userEmail)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this job'
      });
    }

    // Update notes
    const updateData = {
      notes: notes || '',
      notesUpdatedAt: new Date(),
      updatedAt: Date.now()
    };

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    ).lean();

    res.json({
      success: true,
      message: 'Notes updated successfully',
      job: {
        id: updatedJob._id,
        notes: updatedJob.notes,
        notesUpdatedAt: updatedJob.notesUpdatedAt
      }
    });
  } catch (error) {
    console.error('Error updating job notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notes',
      details: error.message
    });
  }
};

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJobStatus,
  deleteJob,
  getJobsByUserInfo,
  getAllUsers,
  updateJobNotes
};
