const mongoose = require('mongoose');
const Job = require('../models/Job');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { getSignedUrl } = require('../utils/s3Service');
const { getSubmissionSourceLabel } = require('../utils/submissionSource');
const { getPlanQuotaForUserIds } = require('../utils/planQuota');

const getApplicationCountsByUserIds = async (userIds) => {
  if (!userIds.length) return {};
  const counts = await Job.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
};

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

    // Search by company, title, or customer name/email
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({
        role: 'user',
        $or: [
          { name: searchRegex },
          { fullName: searchRegex },
          { email: searchRegex },
        ],
      })
        .select('_id')
        .lean();
      const matchingUserIds = matchingUsers.map((u) => u._id);
      const orConditions = [
        { company: searchRegex },
        { title: searchRegex },
      ];
      if (matchingUserIds.length > 0) {
        orConditions.push({ userId: { $in: matchingUserIds } });
      }
      query.$or = orConditions;
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
    let customerList = [];
    if (isSuperAdmin) {
      const users = await User.find({ role: 'user' })
        .select('name fullName email')
        .sort({ fullName: 1, name: 1, email: 1 })
        .lean();
      customerCount = users.length;
      const appCounts = await getApplicationCountsByUserIds(users.map((u) => u._id));
      customerList = users.map((u) => ({
        id: u._id,
        name: u.fullName || u.name || '—',
        email: u.email,
        applicationsCount: appCounts[String(u._id)] || 0,
      }));
    } else {
      const assigneeOid = new mongoose.Types.ObjectId(String(employeeId));
      const distinctCustomerIds = await Job.aggregate([
        {
          $match: {
            assignedTo: assigneeOid,
            userId: { $exists: true, $ne: null },
          },
        },
        { $group: { _id: '$userId' } },
      ]);
      const userIds = distinctCustomerIds.map((d) => d._id).filter(Boolean);
      customerCount = userIds.length;
      if (userIds.length > 0) {
        const users = await User.find({ _id: { $in: userIds } })
          .select('name fullName email')
          .sort({ fullName: 1, name: 1, email: 1 })
          .lean();
        const empUserIds = users.map((u) => u._id);
        const appCounts = await getApplicationCountsByUserIds(empUserIds);
        const planQuotas = await getPlanQuotaForUserIds(empUserIds);
        customerList = users.map((u) => ({
          id: u._id,
          name: u.fullName || u.name || '—',
          email: u.email,
          applicationsCount: appCounts[String(u._id)] || 0,
          planQuota: planQuotas[String(u._id)] || null,
        }));
      }
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

    const jobUserIds = [
      ...new Set(
        jobs
          .map((j) => (j.userId?._id || j.userId)?.toString())
          .filter(Boolean)
      ),
    ];
    const jobUserOids = jobUserIds.map((id) => new mongoose.Types.ObjectId(id));
    const jobUserAppCounts = await getApplicationCountsByUserIds(jobUserOids);
    const jobUserPlanQuotas = await getPlanQuotaForUserIds(jobUserOids);

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

      const uid = user?._id ? user._id.toString() : null;

      return {
        id: job._id,
        userId: uid,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        userName: user ? (user.fullName || user.name || 'N/A') : (job.userInfo?.name || 'N/A'),
        applicant: user ? (user.fullName || user.name || 'N/A') : (job.userInfo?.name || 'N/A'),
        applicantEmail: user ? user.email : null,
        userApplicationsCount: uid ? (jobUserAppCounts[uid] || 0) : 0,
        planQuota: uid ? (jobUserPlanQuotas[uid] || null) : null,
        assignedTo: job.assignedTo ? job.assignedTo.name : null,
        status: job.status,
        link: job.jobUrl,
        date: job.createdAt,
        platform: job.platform || 'Unknown',
        submissionSource: job.submissionSource || null,
        submissionSourceLabel: getSubmissionSourceLabel(job.submissionSource),
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
        customerList,
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
