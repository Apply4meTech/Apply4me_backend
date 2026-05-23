/**
 * Derives onboarding step completion from stored User fields (no per-step timestamps in DB).
 */
const buildOnboardingJourney = (user) => {
  const u = user || {};
  const hasPersonal =
    !!(u.fullName || u.name) &&
    !!(u.phone || u.email) &&
    !!(u.currentLocation || u.address || u.suburb);

  const hasJobPrefs =
    (u.primaryJobTitles?.length > 0) ||
    (u.skills?.length > 0) ||
    u.totalYearsExperience != null ||
    !!u.seniorityLevel;

  const hasDocs = !!(u.resume_details?.key || u.resume_details?.url);
  const hasEmployment =
    !!u.currentRole ||
    (u.employmentHistory?.length > 0) ||
    !!u.previousRoles;
  const hasCompliance =
    !!(u.policeCheck || u.workingWithChildrenCheck || u.securityClearance || u.driversLicence);
  const hasAvailability = !!(u.availableStartDate || u.noticePeriod);
  const hasAppPrefs = !!(u.howToApply || u.companiesToAvoid);
  const hasAdditional = !!(u.anythingElse || u.portfolioWebsite || u.github || u.linkedinProfile);
  const hasConsent =
    u.consentInfoAccurate === true &&
    u.consentSubmitApplications === true &&
    u.consentTermsAndPrivacy === true;

  const steps = [
    { step: 1, key: 'personal', name: 'Personal details', completed: hasPersonal },
    { step: 2, key: 'job_preferences', name: 'Job preferences & compensation', completed: hasJobPrefs },
    { step: 3, key: 'documents', name: 'Resume & documents', completed: hasDocs },
    { step: 4, key: 'employment', name: 'Employment history', completed: hasEmployment },
    { step: 5, key: 'compliance', name: 'Compliance & checks', completed: hasCompliance },
    { step: 6, key: 'availability', name: 'Availability', completed: hasAvailability },
    { step: 7, key: 'application_prefs', name: 'Application preferences', completed: hasAppPrefs },
    { step: 8, key: 'additional', name: 'Additional information', completed: hasAdditional },
    { step: 9, key: 'consent', name: 'Consent & authorisation', completed: hasConsent },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    isComplete: !!u.isOnboardingComplete,
    completedAt: u.onboardingCompletedAt || (u.isOnboardingComplete ? u.updatedAt : null),
    registeredAt: u.createdAt,
  };
};

module.exports = { buildOnboardingJourney };
