const mongoose = require('mongoose');
const Job = require('../models/Job');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { getSignedUrl } = require('../utils/s3Service');

/**
 * Get dashboard data for employee/super admin
 * GET /api/employee/dashboard?page=1&limit=10&search=...&status=...
 */
const getEmployeeDashboardData = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    const employee = req.employee;
    const isSuperAdmin = employee.role === 'super_admin';
    const { search, status, page = 1, limit = 10, sortBy = 'title', sortOrder = 'asc' } = req.query;

    let query = {};
    
    // If not super admin, only show jobs assigned to this employee
    if (!isSuperAdmin) {
      query.assignedTo = employeeId;
    }

    // Search by company, title, applicant
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { company: searchRegex },
        { title: searchRegex }
      ];
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Base query for stats (no search, no status filter - dashboard summary)
    const baseQuery = {};
    if (!isSuperAdmin) baseQuery.assignedTo = employeeId;
    const totalJobs = await Job.countDocuments(baseQuery);

    const totalCompleted = await Job.countDocuments({
      ...baseQuery,
      status: 'completed'
    });

    const totalPending = await Job.countDocuments({
      ...baseQuery,
      status: { $in: ['pending', 'assigned'] }
    });

    const totalInProgress = await Job.countDocuments({
      ...baseQuery,
      status: 'in_progress'
    });

    // Customers: super admin = all registered customers (User role user); employee = distinct users on assigned jobs
    let customerCount = 0;
    if (isSuperAdmin) {
      customerCount = await User.countDocuments({ role: 'user' });
    } else {
      const assigneeOid = new mongoose.Types.ObjectId(String(employeeId));
      const distinctCustomers = await Job.aggregate([
        {
          $match: {
            assignedTo: assigneeOid,
            userId: { $exists: true, $ne: null }
          }
        },
        { $group: { _id: '$userId' } },
        { $count: 'count' }
      ]);
      customerCount = distinctCustomers[0]?.count ?? 0;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Build sort: default sort by job title (asc)
    const sortField = sortBy === 'title' ? 'title' : 'createdAt';
    const sortDir = sortOrder === 'desc' ? -1 : 1;
    const sortObj = { [sortField]: sortDir };

    // Get jobs with details (include subscription.planName, resume_details, atsReport for user resumes)
    const jobs = await Job.find(query)
      .populate('userId', 'name email fullName subscription.planName resume_details atsReport.optimizedResumeDetails purchasedAddons cv_details')
      .populate('assignedTo', 'name email')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const getSignedUrlSafe = async (key) => {
      if (!key) return null;
      try {
        return await getSignedUrl(key, 3600);
      } catch (err) {
        console.error('Error getting signed URL:', err);
        return null;
      }
    };

    // Format jobs - include userResumes (ATS + original) for employee to access
    const formattedJobs = await Promise.all(jobs.map(async (job) => {
      let user = job.userId;
      if (!user && job.userInfo?.email) {
        user = await User.findOne({ email: job.userInfo.email.toLowerCase() }).select('name email fullName subscription.planName resume_details atsReport.optimizedResumeDetails purchasedAddons cv_details');
      }
      const userPlanName = user?.subscription?.planName || null;
      const hasResumeAddon = user?.purchasedAddons?.some(a => a.name === 'resume_rewrite');
      const canCustomizeResume = (userPlanName && userPlanName !== 'Starter') || !!hasResumeAddon;

      let atsResumeUrl = null;
      let originalResumeUrl = null;
      if (user) {
        const atsDetails = user.atsReport?.optimizedResumeDetails;
        const origDetails = user.resume_details;
        if (atsDetails?.key) atsResumeUrl = await getSignedUrlSafe(atsDetails.key);
        else if (atsDetails?.url) atsResumeUrl = atsDetails.url;
        if (origDetails?.key) originalResumeUrl = await getSignedUrlSafe(origDetails.key);
        else if (origDetails?.url) originalResumeUrl = origDetails.url;
      }

      const userResumes = [];
      if (atsResumeUrl) {
        userResumes.push({
          type: 'ats',
          url: atsResumeUrl,
          fileName: user.atsReport?.optimizedResumeDetails?.fileName || 'ATS Optimized Resume.pdf',
          label: 'ATS'
        });
      }
      if (originalResumeUrl) {
        userResumes.push({
          type: 'original',
          url: originalResumeUrl,
          fileName: user.resume_details?.fileName || 'Original Resume.pdf',
          label: 'Original'
        });
      }

      const jobResumeUrl = job.resume?.key ? await getSignedUrlSafe(job.resume.key) : (job.resume?.url || null);
      const jobCoverLetterUrl = job.coverLetter?.key ? await getSignedUrlSafe(job.coverLetter.key) : (job.coverLetter?.url || null);
      const jobScreenshotUrl = job.screenshotProof?.key ? await getSignedUrlSafe(job.screenshotProof.key) : (job.screenshotProof?.url || null);

      // User's default cover letter from onboarding (cv_details) - fallback when job has no cover letter
      let userCoverLetter = null;
      if (user?.cv_details?.key) {
        const userCvUrl = await getSignedUrlSafe(user.cv_details.key);
        userCoverLetter = { ...user.cv_details, url: userCvUrl || user.cv_details.url };
      } else if (user?.cv_details?.url) {
        userCoverLetter = { ...user.cv_details };
      }

      // Effective cover letter: job-specific first, else user's default from onboarding
      const effectiveCoverLetter = job.coverLetter
        ? { ...job.coverLetter, url: jobCoverLetterUrl || job.coverLetter.url }
        : userCoverLetter;

      return {
        id: job._id,
        userId: user?._id ? user._id.toString() : null,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        userName: user ? (user.fullName || user.name || 'N/A') : (job.userInfo?.name || 'N/A'),
        applicant: user ? (user.fullName || user.name || 'N/A') : (job.userInfo?.name || 'N/A'),
        applicantEmail: user ? user.email : null,
        assignedTo: job.assignedTo ? job.assignedTo.name : null,
        status: job.status,
        link: job.jobUrl,
        date: job.createdAt,
        platform: job.platform || 'Unknown',
        emailData: job.emailData || null,
        resume: job.resume ? { ...job.resume, url: jobResumeUrl || job.resume.url } : null,
        coverLetter: effectiveCoverLetter,
        jobCoverLetter: job.coverLetter ? { ...job.coverLetter, url: jobCoverLetterUrl || job.coverLetter.url } : null,
        userCoverLetter,
        screenshotProof: job.screenshotProof ? { ...job.screenshotProof, url: jobScreenshotUrl || job.screenshotProof.url } : null,
        notes: job.notes || '',
        notesUpdatedAt: job.notesUpdatedAt || null,
        metadata: job.metadata || null,
        userPlanName,
        canCustomizeResume,
        userResumes
      };
    }));

    const totalFiltered = await Job.countDocuments(query);

    res.json({
      success: true,
      data: {
        totalJobs,
        totalCompleted,
        totalPending,
        totalInProgress,
        customerCount,
        jobs: formattedJobs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalFiltered,
          totalPages: Math.ceil(totalFiltered / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employee dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
};

module.exports = {
  getEmployeeDashboardData
};
