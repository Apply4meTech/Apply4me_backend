const User = require('../models/User');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Service');

// Save or update onboarding data
const saveOnboarding = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Extract form data (from JSON - files are uploaded separately)
    const {
      // Step 1: Personal Information
      fullName,
      phoneCode,
      phone,
      address,
      // Separate address fields
      houseNumber,
      streetName,
      suburb,
      state,
      postcode,
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
      resume_details, // File details object (already uploaded)
      cv_details, // File details object (already uploaded)
      portfolioWebsite,
      github,
      linkedinProfile,
      personalBlog
    } = req.body;

    // Parse array fields from JSON
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

    // Validate resume is mandatory
    const user = await User.findById(userId);
    if (!user.resume_details && !resume_details) {
      return res.status(400).json({
        success: false,
        error: 'Resume is required. Please upload your resume.'
      });
    }

    // Build update object
    const updateData = {
      isOnboardingComplete: true,
      updatedAt: Date.now()
    };

    // Step 1 fields
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phoneCode !== undefined) updateData.phoneCode = phoneCode;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    // Separate address fields
    if (houseNumber !== undefined) updateData.houseNumber = houseNumber;
    if (streetName !== undefined) updateData.streetName = streetName;
    if (suburb !== undefined) updateData.suburb = suburb;
    if (state !== undefined) updateData.state = state;
    if (postcode !== undefined) updateData.postcode = postcode;
    if (openToRelocate !== undefined) {
      updateData.openToRelocate = openToRelocate === 'true' || openToRelocate === true;
    }
    if (countryOfWork !== undefined && countryOfWork !== '') {
      updateData.countryOfWork = countryOfWork;
    }
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
    if (seniorityLevel !== undefined && seniorityLevel !== '') {
      updateData.seniorityLevel = seniorityLevel;
    }
    if (parsedJobTypes && parsedJobTypes.length > 0) {
      updateData.jobTypes = parsedJobTypes;
    }
    if (workLocation !== undefined && workLocation !== '') {
      updateData.workLocation = workLocation;
    }
    if (locationPreference !== undefined && locationPreference !== '') {
      updateData.locationPreference = locationPreference;
    }
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

    // File details are already saved in database when files were uploaded
    // Use the details from request body (which come from form state)
    if (resume_details) {
      updateData.resume_details = resume_details;
    } else if (user.resume_details) {
      // Keep existing resume_details if not provided in request
      updateData.resume_details = user.resume_details;
    }

    if (cv_details) {
      updateData.cv_details = cv_details;
    } else if (user.cv_details) {
      // Keep existing cv_details if not provided in request
      updateData.cv_details = user.cv_details;
    }

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
      message: 'Onboarding data saved successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isOnboardingComplete: updatedUser.isOnboardingComplete,
        fullName: updatedUser.fullName,
        phoneCode: updatedUser.phoneCode,
        phone: updatedUser.phone,
        address: updatedUser.address,
        houseNumber: updatedUser.houseNumber,
        streetName: updatedUser.streetName,
        suburb: updatedUser.suburb,
        state: updatedUser.state,
        postcode: updatedUser.postcode,
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
        cv_details: updatedUser.cv_details || null,
        portfolioWebsite: updatedUser.portfolioWebsite,
        github: updatedUser.github,
        linkedinProfile: updatedUser.linkedinProfile,
        personalBlog: updatedUser.personalBlog
      }
    });
  } catch (error) {
    console.error('Error saving onboarding data:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to save onboarding data',
      details: error.message
    });
  }
};

// Get onboarding data
const getOnboarding = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      onboarding: {
        isOnboardingComplete: user.isOnboardingComplete,
        fullName: user.fullName,
        email: user.email,
        phoneCode: user.phoneCode,
        phone: user.phone,
        address: user.address,
        houseNumber: user.houseNumber,
        streetName: user.streetName,
        suburb: user.suburb,
        state: user.state,
        postcode: user.postcode,
        openToRelocate: user.openToRelocate,
        countryOfWork: user.countryOfWork,
        visaSponsorshipRequired: user.visaSponsorshipRequired,
        primaryJobTitles: user.primaryJobTitles,
        skills: user.skills,
        totalYearsExperience: user.totalYearsExperience,
        seniorityLevel: user.seniorityLevel,
        jobTypes: user.jobTypes,
        workLocation: user.workLocation,
        locationPreference: user.locationPreference,
        remoteOnly: user.remoteOnly,
        minAcceptableSalary: user.minAcceptableSalary,
        preferredSalaryMin: user.preferredSalaryMin,
        preferredSalaryMax: user.preferredSalaryMax,
        equityPreference: user.equityPreference,
        resume_details: user.resume_details || null,
        cv_details: user.cv_details || null,
        portfolioWebsite: user.portfolioWebsite,
        github: user.github,
        linkedinProfile: user.linkedinProfile,
        personalBlog: user.personalBlog
      }
    });
  } catch (error) {
    console.error('Error fetching onboarding data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch onboarding data'
    });
  }
};

module.exports = {
  saveOnboarding,
  getOnboarding
};
