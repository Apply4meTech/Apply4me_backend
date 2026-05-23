const User = require('../models/User');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Service');

// Save or update onboarding data
const saveOnboarding = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Extract form data (from JSON - files are uploaded separately)
    const {
      // Step 1: Personal Details
      fullName,
      email,
      phoneCode,
      phone,
      currentLocation,
      workRightsInAustralia,
      visaType,
      address,
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
      // Step 3: Resume & Documents
      resume_details,
      cv_details,
      academicTranscripts_details,
      certifications_details,
      portfolioWebsite,
      github,
      linkedinProfile,
      personalBlog,
      // Step 4: Employment History
      currentRole,
      previousRoles,
      keyResponsibilities,
      keyAchievements,
      employmentHistory,
      // Step 5: Compliance & Checks
      policeCheck,
      workingWithChildrenCheck,
      securityClearance,
      driversLicence,
      // Step 6: Availability
      availableStartDate,
      noticePeriod,
      // Step 7: Application Preferences
      howToApply,
      companiesToAvoid,
      // Step 8: Additional Information
      anythingElse,
      // Step 9: Consent
      consentInfoAccurate,
      consentSubmitApplications,
      consentAccountCreation,
      consentTermsAndPrivacy
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
      onboardingCompletedAt: new Date(),
      updatedAt: Date.now()
    };

    // Step 1 fields
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined && email.trim() && /^\S+@\S+\.\S+$/.test(email)) {
      updateData.email = email.trim().toLowerCase();
    }
    if (phoneCode !== undefined) updateData.phoneCode = phoneCode;
    if (phone !== undefined) updateData.phone = phone;
    if (currentLocation !== undefined) updateData.currentLocation = currentLocation;
    if (workRightsInAustralia !== undefined) updateData.workRightsInAustralia = workRightsInAustralia;
    if (visaType !== undefined) updateData.visaType = visaType;
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
      updateData.cv_details = user.cv_details;
    }
    if (academicTranscripts_details) updateData.academicTranscripts_details = academicTranscripts_details;
    if (certifications_details) updateData.certifications_details = certifications_details;

    // Step 4: Employment History
    if (currentRole !== undefined) updateData.currentRole = currentRole;
    if (previousRoles !== undefined) updateData.previousRoles = previousRoles;
    if (keyResponsibilities !== undefined) updateData.keyResponsibilities = keyResponsibilities;
    if (keyAchievements !== undefined) updateData.keyAchievements = keyAchievements;
    if (employmentHistory !== undefined && Array.isArray(employmentHistory)) {
      updateData.employmentHistory = employmentHistory.map((row) => ({
        jobTitle: row.jobTitle || '',
        company: row.company || '',
        startDate: row.startDate || '',
        endDate: row.isCurrent ? '' : (row.endDate || ''),
        isCurrent: !!row.isCurrent,
        responsibilities: row.responsibilities || '',
      }));
    }

    // Step 5: Compliance & Checks
    if (policeCheck !== undefined) updateData.policeCheck = policeCheck;
    if (workingWithChildrenCheck !== undefined) updateData.workingWithChildrenCheck = workingWithChildrenCheck;
    if (securityClearance !== undefined) updateData.securityClearance = securityClearance;
    if (driversLicence !== undefined) updateData.driversLicence = driversLicence;

    // Step 6: Availability
    if (availableStartDate !== undefined && availableStartDate !== '') {
      updateData.availableStartDate = new Date(availableStartDate);
    }
    if (noticePeriod !== undefined) updateData.noticePeriod = noticePeriod;

    // Step 7: Application Preferences
    if (howToApply !== undefined) updateData.howToApply = howToApply;
    if (companiesToAvoid !== undefined) updateData.companiesToAvoid = companiesToAvoid;

    // Step 8: Additional Information
    if (anythingElse !== undefined) updateData.anythingElse = anythingElse;
    if (portfolioWebsite !== undefined) updateData.portfolioWebsite = portfolioWebsite;
    if (linkedinProfile !== undefined) updateData.linkedinProfile = linkedinProfile;

    // Step 9: Consent
    if (consentInfoAccurate !== undefined) updateData.consentInfoAccurate = consentInfoAccurate === 'true' || consentInfoAccurate === true;
    if (consentSubmitApplications !== undefined) updateData.consentSubmitApplications = consentSubmitApplications === 'true' || consentSubmitApplications === true;
    if (consentAccountCreation !== undefined) updateData.consentAccountCreation = consentAccountCreation === 'true' || consentAccountCreation === true;
    if (consentTermsAndPrivacy !== undefined) updateData.consentTermsAndPrivacy = consentTermsAndPrivacy === 'true' || consentTermsAndPrivacy === true;

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
        email: updatedUser.email,
        phoneCode: updatedUser.phoneCode,
        phone: updatedUser.phone,
        currentLocation: updatedUser.currentLocation,
        workRightsInAustralia: updatedUser.workRightsInAustralia,
        visaType: updatedUser.visaType,
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
        academicTranscripts_details: updatedUser.academicTranscripts_details || null,
        certifications_details: updatedUser.certifications_details || null,
        currentRole: updatedUser.currentRole,
        previousRoles: updatedUser.previousRoles,
        keyResponsibilities: updatedUser.keyResponsibilities,
        keyAchievements: updatedUser.keyAchievements,
        policeCheck: updatedUser.policeCheck,
        workingWithChildrenCheck: updatedUser.workingWithChildrenCheck,
        securityClearance: updatedUser.securityClearance,
        driversLicence: updatedUser.driversLicence,
        availableStartDate: updatedUser.availableStartDate,
        noticePeriod: updatedUser.noticePeriod,
        howToApply: updatedUser.howToApply,
        companiesToAvoid: updatedUser.companiesToAvoid,
        anythingElse: updatedUser.anythingElse,
        consentInfoAccurate: updatedUser.consentInfoAccurate,
        consentSubmitApplications: updatedUser.consentSubmitApplications,
        consentAccountCreation: updatedUser.consentAccountCreation,
        consentTermsAndPrivacy: updatedUser.consentTermsAndPrivacy,
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
        currentLocation: user.currentLocation,
        workRightsInAustralia: user.workRightsInAustralia,
        visaType: user.visaType,
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
        academicTranscripts_details: user.academicTranscripts_details || null,
        certifications_details: user.certifications_details || null,
        currentRole: user.currentRole,
        previousRoles: user.previousRoles,
        keyResponsibilities: user.keyResponsibilities,
        keyAchievements: user.keyAchievements,
        employmentHistory: user.employmentHistory || [],
        portfolioWebsite: user.portfolioWebsite,
        github: user.github,
        linkedinProfile: user.linkedinProfile,
        personalBlog: user.personalBlog,
        policeCheck: user.policeCheck,
        workingWithChildrenCheck: user.workingWithChildrenCheck,
        securityClearance: user.securityClearance,
        driversLicence: user.driversLicence,
        availableStartDate: user.availableStartDate,
        noticePeriod: user.noticePeriod,
        howToApply: user.howToApply,
        companiesToAvoid: user.companiesToAvoid,
        anythingElse: user.anythingElse,
        consentInfoAccurate: user.consentInfoAccurate,
        consentSubmitApplications: user.consentSubmitApplications,
        consentAccountCreation: user.consentAccountCreation,
        consentTermsAndPrivacy: user.consentTermsAndPrivacy
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
