const User = require('../models/User');
const Job = require('../models/Job');
const { getSignedUrl } = require('../utils/s3Service');

/**
 * Get customer profile (read-only) for employee/super admin
 * GET /api/employee/customers/:userId
 * Employee must have access: super_admin or has job assigned from this customer
 */
const getCustomerProfile = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    const employee = req.employee;
    const isSuperAdmin = employee.role === 'super_admin';
    const { userId: customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ success: false, error: 'Customer ID required' });
    }

    // Verify employee has access: super_admin can view any; else must have job from this customer
    if (!isSuperAdmin) {
      const hasAccess = await Job.exists({
        userId: customerId,
        assignedTo: employeeId
      });
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to view this customer'
        });
      }
    }

    const user = await User.findById(customerId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const getSignedUrlSafe = async (key) => {
      if (!key) return null;
      try {
        return await getSignedUrl(key, 3600);
      } catch (err) {
        console.error('Error getting signed URL:', err);
        return null;
      }
    };

    let resumeUrl = null;
    let cvUrl = null;
    let atsResumeUrl = null;

    if (user.resume_details?.key) {
      resumeUrl = await getSignedUrlSafe(user.resume_details.key) || user.resume_details.url;
    } else if (user.resume_details?.url) {
      resumeUrl = user.resume_details.url;
    }

    if (user.cv_details?.key) {
      cvUrl = await getSignedUrlSafe(user.cv_details.key) || user.cv_details.url;
    } else if (user.cv_details?.url) {
      cvUrl = user.cv_details.url;
    }

    if (user.atsReport?.optimizedResumeDetails?.key) {
      atsResumeUrl = await getSignedUrlSafe(user.atsReport.optimizedResumeDetails.key) || user.atsReport.optimizedResumeDetails.url;
    } else if (user.atsReport?.optimizedResumeDetails?.url) {
      atsResumeUrl = user.atsReport.optimizedResumeDetails.url;
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture || null,
        phoneCode: user.phoneCode,
        phone: user.phone,
        address: user.address,
        openToRelocate: user.openToRelocate,
        countryOfWork: user.countryOfWork,
        visaSponsorshipRequired: user.visaSponsorshipRequired,
        primaryJobTitles: user.primaryJobTitles || [],
        skills: user.skills || [],
        totalYearsExperience: user.totalYearsExperience,
        seniorityLevel: user.seniorityLevel,
        jobTypes: user.jobTypes || [],
        workLocation: user.workLocation,
        locationPreference: user.locationPreference,
        remoteOnly: user.remoteOnly,
        minAcceptableSalary: user.minAcceptableSalary,
        preferredSalaryMin: user.preferredSalaryMin,
        preferredSalaryMax: user.preferredSalaryMax,
        equityPreference: user.equityPreference,
        portfolioWebsite: user.portfolioWebsite,
        github: user.github,
        linkedinProfile: user.linkedinProfile,
        personalBlog: user.personalBlog,
        resume: user.resume_details ? {
          fileName: user.resume_details.fileName,
          url: resumeUrl
        } : null,
        coverLetter: user.cv_details ? {
          fileName: user.cv_details.fileName,
          url: cvUrl
        } : null,
        atsResume: user.atsReport?.optimizedResumeDetails ? {
          fileName: user.atsReport.optimizedResumeDetails.fileName,
          url: atsResumeUrl
        } : null,
        subscription: user.subscription || null
      }
    });
  } catch (error) {
    console.error('Error fetching customer profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer profile',
      details: error.message
    });
  }
};

module.exports = {
  getCustomerProfile
};
