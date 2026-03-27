const User = require('../models/User');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Service');

/**
 * Only expose ATS optimized resume when a real file exists in storage (avoids empty {} / 0-byte UI).
 */
const getOptimizedResumeDetailsForResponse = (user) => {
  const key = user.atsReport?.optimizedResumeKey || user.atsReport?.optimizedResumeDetails?.key;
  if (!key) return null;
  return user.atsReport?.optimizedResumeDetails || null;
};

/**
 * Get user profile with all onboarding details
 * GET /api/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture || null,
        // Step 1: Personal Information
        fullName: user.fullName,
        phoneCode: user.phoneCode,
        phone: user.phone,
        address: user.address,
        openToRelocate: user.openToRelocate,
        countryOfWork: user.countryOfWork,
        visaSponsorshipRequired: user.visaSponsorshipRequired,
        // Step 2: Job Preferences & Compensation
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
        // Step 3: Documents & Links
        resume_details: user.resume_details || null,
        optimizedResumeDetails: getOptimizedResumeDetailsForResponse(user),
        cv_details: user.cv_details || null,
        portfolioWebsite: user.portfolioWebsite,
        github: user.github,
        linkedinProfile: user.linkedinProfile,
        personalBlog: user.personalBlog,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      details: error.message
    });
  }
};

/**
 * Update user profile
 * PUT /api/profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    
    const {
      // Step 1: Personal Information
      fullName,
      phoneCode,
      phone,
      address,
      openToRelocate,
      countryOfWork,
      visaSponsorshipRequired,
      // Step 2: Job Preferences & Compensation
      primaryJobTitles,
      skills,
      totalYearsExperience,
      seniorityLevel,
      jobTypes,
      workLocation,
      locationPreference,
      remoteOnly,
      minAcceptableSalary,
      preferredSalaryMin,
      preferredSalaryMax,
      equityPreference,
      // Step 3: Documents & Links
      portfolioWebsite,
      github,
      linkedinProfile,
      personalBlog
    } = req.body;

    // Parse array fields
    const parseArrayField = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field.split(',').filter(Boolean);
        }
      }
      return [];
    };

    const parsedPrimaryJobTitles = parseArrayField(primaryJobTitles);
    const parsedSkills = parseArrayField(skills);
    const parsedJobTypes = parseArrayField(jobTypes);

    // Build update object
    const updateData = {
      updatedAt: Date.now()
    };

    // Step 1 fields
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phoneCode !== undefined) updateData.phoneCode = phoneCode;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (openToRelocate !== undefined) {
      updateData.openToRelocate = openToRelocate === 'true' || openToRelocate === true;
    }
    if (countryOfWork !== undefined) updateData.countryOfWork = countryOfWork;
    if (visaSponsorshipRequired !== undefined) {
      updateData.visaSponsorshipRequired = visaSponsorshipRequired === 'true' || visaSponsorshipRequired === true;
    }

    // Step 2 fields
    if (parsedPrimaryJobTitles && parsedPrimaryJobTitles.length > 0) {
      updateData.primaryJobTitles = parsedPrimaryJobTitles;
    }
    if (parsedSkills && parsedSkills.length > 0) {
      updateData.skills = parsedSkills;
    }
    if (totalYearsExperience !== undefined && totalYearsExperience !== '') {
      updateData.totalYearsExperience = Number(totalYearsExperience);
    }
    if (seniorityLevel !== undefined) updateData.seniorityLevel = seniorityLevel;
    if (parsedJobTypes && parsedJobTypes.length > 0) {
      updateData.jobTypes = parsedJobTypes;
    }
    if (workLocation !== undefined) updateData.workLocation = workLocation;
    if (locationPreference !== undefined) updateData.locationPreference = locationPreference;
    if (remoteOnly !== undefined) {
      updateData.remoteOnly = remoteOnly === 'true' || remoteOnly === true;
    }
    if (minAcceptableSalary !== undefined && minAcceptableSalary !== '') {
      updateData.minAcceptableSalary = Number(minAcceptableSalary);
    }
    if (preferredSalaryMin !== undefined && preferredSalaryMin !== '') {
      updateData.preferredSalaryMin = Number(preferredSalaryMin);
    }
    if (preferredSalaryMax !== undefined && preferredSalaryMax !== '') {
      updateData.preferredSalaryMax = Number(preferredSalaryMax);
    }
    if (equityPreference !== undefined) {
      updateData.equityPreference = equityPreference === 'true' || equityPreference === true;
    }

    // Step 3 fields
    if (portfolioWebsite !== undefined) updateData.portfolioWebsite = portfolioWebsite;
    if (github !== undefined) updateData.github = github;
    if (linkedinProfile !== undefined) updateData.linkedinProfile = linkedinProfile;
    if (personalBlog !== undefined) updateData.personalBlog = personalBlog;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.fullName || updatedUser.name,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture || null,
        fullName: updatedUser.fullName,
        phoneCode: updatedUser.phoneCode,
        phone: updatedUser.phone,
        address: updatedUser.address,
        openToRelocate: updatedUser.openToRelocate,
        countryOfWork: updatedUser.countryOfWork,
        visaSponsorshipRequired: updatedUser.visaSponsorshipRequired,
        primaryJobTitles: updatedUser.primaryJobTitles,
        skills: updatedUser.skills,
        totalYearsExperience: updatedUser.totalYearsExperience,
        seniorityLevel: updatedUser.seniorityLevel,
        jobTypes: updatedUser.jobTypes,
        workLocation: updatedUser.workLocation,
        locationPreference: updatedUser.locationPreference,
        remoteOnly: updatedUser.remoteOnly,
        minAcceptableSalary: updatedUser.minAcceptableSalary,
        preferredSalaryMin: updatedUser.preferredSalaryMin,
        preferredSalaryMax: updatedUser.preferredSalaryMax,
        equityPreference: updatedUser.equityPreference,
        resume_details: updatedUser.resume_details || null,
        optimizedResumeDetails: getOptimizedResumeDetailsForResponse(updatedUser),
        cv_details: updatedUser.cv_details || null,
        portfolioWebsite: updatedUser.portfolioWebsite,
        github: updatedUser.github,
        linkedinProfile: updatedUser.linkedinProfile,
        personalBlog: updatedUser.personalBlog,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: error.message
    });
  }
};

/**
 * Upload profile picture
 * POST /api/profile/picture
 */
const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    // Get user to check for existing profile picture
    const user = await User.findById(userId);
    
    // Delete old profile picture from S3 if exists
    if (user.profilePicture && user.profilePicture.key) {
      try {
        await deleteFileFromS3(user.profilePicture.key);
      } catch (error) {
        console.error('Error deleting old profile picture:', error);
        // Continue even if deletion fails
      }
    }

    // Upload to S3
    const uploadResult = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'profile-pictures'
    );

    // Prepare profile picture object
    const profilePicture = {
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      resourceId: uploadResult.resourceId,
      url: uploadResult.url,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      mimeType: uploadResult.mimeType,
      uploadedAt: uploadResult.uploadedAt || new Date()
    };

    // Save to database
    await User.findByIdAndUpdate(userId, {
      profilePicture: profilePicture
    });

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: profilePicture
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload profile picture',
      details: error.message
    });
  }
};

/**
 * Delete profile picture
 * DELETE /api/profile/picture
 */
const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId);
    
    if (!user.profilePicture || !user.profilePicture.key) {
      return res.status(404).json({
        success: false,
        error: 'Profile picture not found'
      });
    }

    // Delete from S3
    try {
      await deleteFileFromS3(user.profilePicture.key);
    } catch (error) {
      console.error('Error deleting profile picture from S3:', error);
      // Continue to delete from database even if S3 deletion fails
    }

    // Delete from database
    await User.findByIdAndUpdate(userId, {
      $unset: { profilePicture: 1 }
    });

    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete profile picture',
      details: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  deleteProfilePicture
};
