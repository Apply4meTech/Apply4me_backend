const { getSignedUrl } = require('./s3Service');
const Payment = require('../models/Payment');
const Job = require('../models/Job');
const { buildOnboardingJourney } = require('./onboardingJourney');
const { getSubmissionSourceLabel } = require('./submissionSource');
const { getPlanQuotaForUser } = require('./planQuota');

const getSignedUrlSafe = async (key) => {
  if (!key) return null;
  try {
    return await getSignedUrl(key, 3600);
  } catch (err) {
    console.error('Error getting signed URL:', err);
    return null;
  }
};

const signDocument = async (details) => {
  if (details == null) return null;
  // Mongoose stores explicit null nested paths as a truthy Subdocument whose
  // toObject() returns null — e.g. visaAttachment_details: null
  const doc = typeof details.toObject === 'function' ? details.toObject() : { ...details };
  if (!doc || typeof doc !== 'object') return null;
  if (!doc.key && !doc.url && !doc.fileName) return null;
  if (doc.key) {
    doc.url = (await getSignedUrlSafe(doc.key)) || doc.url;
  }
  return doc;
};

const docForEmployee = async (details) => {
  const signed = await signDocument(details);
  if (!signed) return null;
  return {
    fileName: signed.fileName,
    fileSize: signed.fileSize,
    url: signed.url,
    mimeType: signed.mimeType,
    uploadedAt: signed.uploadedAt,
  };
};

/**
 * Full customer profile for employee/super-admin (all onboarding fields + signed document URLs).
 */
const getLatestPayment = async (user) => {
  let payment = null;
  if (user.subscription?.paymentId) {
    payment = await Payment.findById(user.subscription.paymentId)
      .select('completedAt initiatedAt planName status amount currency')
      .lean();
  }
  if (!payment) {
    payment = await Payment.findOne({ userId: user._id, status: 'SUCCESS' })
      .sort({ completedAt: -1 })
      .select('completedAt initiatedAt planName status amount currency')
      .lean();
  }
  if (!payment) return null;
  return {
    completedAt: payment.completedAt,
    initiatedAt: payment.initiatedAt,
    planName: payment.planName,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
  };
};

const buildCustomerProfileResponse = async (user) => {
  const resume = await docForEmployee(user.resume_details);
  const coverLetter = await docForEmployee(user.cv_details);
  const academicTranscripts = await docForEmployee(user.academicTranscripts_details);
  const certifications = await docForEmployee(user.certifications_details);
  const visaAttachment = await docForEmployee(user.visaAttachment_details);
  const atsResume = await docForEmployee(user.atsReport?.optimizedResumeDetails);

  const formatAddress = () => {
    const parts = [
      user.houseNumber,
      user.streetName,
      user.suburb,
      user.state,
      user.postcode,
    ].filter(Boolean);
    if (parts.length) return parts.join(', ');
    return user.address || null;
  };

  const applicationsCount = await Job.countDocuments({ userId: user._id });
  const planQuota = await getPlanQuotaForUser(user._id);
  const payment = await getLatestPayment(user);
  const onboardingJourney = buildOnboardingJourney(user);

  return {
    id: user._id,
    name: user.name,
    fullName: user.fullName,
    email: user.email,
    profilePicture: user.profilePicture || null,
    isOnboardingComplete: user.isOnboardingComplete,
    onboardingCompletedAt: user.onboardingCompletedAt || null,
    applicationsCount,
    planQuota,
    onboardingJourney,
    payment,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    // Personal details
    dateOfBirth: user.dateOfBirth || null,
    phoneCode: user.phoneCode,
    phone: user.phone,
    currentLocation: user.currentLocation,
    workRightsInAustralia: user.workRightsInAustralia,
    visaType: user.visaType,
    address: user.address,
    formattedAddress: formatAddress(),
    houseNumber: user.houseNumber,
    streetName: user.streetName,
    suburb: user.suburb,
    state: user.state,
    postcode: user.postcode,
    openToRelocate: user.openToRelocate,
    countryOfWork: user.countryOfWork,
    visaSponsorshipRequired: user.visaSponsorshipRequired,
    // Job preferences (legacy + onboarding)
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
    // Employment history
    currentRole: user.currentRole,
    previousRoles: user.previousRoles,
    keyResponsibilities: user.keyResponsibilities,
    keyAchievements: user.keyAchievements,
    employmentHistory: user.employmentHistory || [],
    // Compliance
    policeCheck: user.policeCheck,
    workingWithChildrenCheck: user.workingWithChildrenCheck,
    securityClearance: user.securityClearance,
    driversLicence: user.driversLicence,
    // Availability
    availableStartDate: user.availableStartDate,
    noticePeriod: user.noticePeriod,
    // Application preferences
    howToApply: user.howToApply,
    companiesToAvoid: user.companiesToAvoid,
    // Additional
    anythingElse: user.anythingElse,
    portfolioWebsite: user.portfolioWebsite,
    github: user.github,
    linkedinProfile: user.linkedinProfile,
    personalBlog: user.personalBlog,
    // Consent
    consentInfoAccurate: user.consentInfoAccurate,
    consentSubmitApplications: user.consentSubmitApplications,
    consentAccountCreation: user.consentAccountCreation,
    consentTermsAndPrivacy: user.consentTermsAndPrivacy,
    // Documents
    resume,
    coverLetter,
    academicTranscripts,
    certifications,
    visaAttachment,
    atsResume,
    resume_details: resume,
    cv_details: coverLetter,
    academicTranscripts_details: academicTranscripts,
    certifications_details: certifications,
    visaAttachment_details: visaAttachment,
    // Subscription & addons
    subscription: user.subscription || null,
    purchasedAddons: user.purchasedAddons || [],
    atsReport: user.atsReport
      ? {
          score: user.atsReport.score,
          analyzedAt: user.atsReport.analyzedAt,
          summary: user.atsReport.summary,
          optimizationScore: user.atsReport.optimizationScore,
          optimizedAt: user.atsReport.optimizedAt,
        }
      : null,
  };
};

const buildCustomerListItem = (user, extras = {}) => ({
  id: user._id,
  name: user.name,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  phoneCode: user.phoneCode,
  isOnboardingComplete: user.isOnboardingComplete,
  subscription: user.subscription
    ? { planName: user.subscription.planName, status: user.subscription.status }
    : null,
  createdAt: user.createdAt,
  applicationsCount: extras.applicationsCount ?? extras.jobsGivenByCustomer ?? 0,
  jobsGivenByCustomer: extras.jobsGivenByCustomer ?? 0,
  jobsApplied: extras.jobsApplied ?? 0,
  jobsPending: extras.jobsPending ?? 0,
  jobTokenBalance: extras.jobTokenBalance ?? null,
  planQuota: extras.planQuota ?? null,
  paymentCompletedAt: extras.paymentCompletedAt ?? null,
  hasPurchased: extras.hasPurchased ?? false,
  journeyStatus: extras.journeyStatus ?? null,
  journeyLabel: extras.journeyLabel ?? null,
});

module.exports = {
  buildCustomerProfileResponse,
  buildCustomerListItem,
  getSubmissionSourceLabel,
};
