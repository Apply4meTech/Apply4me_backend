/**
 * One-time Stripe add-ons: planName stored on Payment / metadata must match keys here.
 * purchasedAddons[].name uses storageName.
 */
const ADDON_BY_PLAN_NAME = {
  ATS_ADDON: { storageName: 'resume_rewrite', amountAud: 39 },
  ADDON_JOB_SEARCH: { storageName: 'job_search', amountAud: 69 },
  ADDON_LINKEDIN: { storageName: 'linkedin_optimisation', amountAud: 29 },
  ADDON_INTERVIEW_PREP: { storageName: 'interview_prep', amountAud: 20 }
};

function getAddonByPlanName(planName) {
  if (!planName || typeof planName !== 'string') return null;
  return ADDON_BY_PLAN_NAME[planName] || null;
}

function isAddonPlanName(planName) {
  return !!getAddonByPlanName(planName);
}

/** Human-readable line for emails / receipts (Stripe planName keys). */
const ADDON_RECEIPT_LABELS = {
  ATS_ADDON: 'Custom Resume Rewrite (ATS-Optimised)',
  ADDON_JOB_SEARCH: 'Job Search by Our Team',
  ADDON_LINKEDIN: 'LinkedIn Profile Optimisation',
  ADDON_INTERVIEW_PREP: 'Interview Prep'
};

function getAddonReceiptLabel(planName) {
  if (!planName) return null;
  return ADDON_RECEIPT_LABELS[planName] || null;
}

module.exports = {
  ADDON_BY_PLAN_NAME,
  getAddonByPlanName,
  isAddonPlanName,
  getAddonReceiptLabel
};
