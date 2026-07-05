const SUBMISSION_SOURCES = [
  'chrome_extension',
  'extension_url',
  'dashboard_url',
  'dashboard_manual',
  'job_finder',
  'employee_external_url',
];

const LABELS = {
  chrome_extension: 'Chrome extension (job page)',
  extension_url: 'Chrome extension (URL pasted)',
  dashboard_url: 'Customer dashboard (URL)',
  dashboard_manual: 'Customer dashboard (manual entry)',
  job_finder: 'Job Finder (Adzuna)',
  employee_external_url: 'AFM team (external job link)',
};

const normalizeSubmissionSource = (value) => {
  if (!value || typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return SUBMISSION_SOURCES.includes(key) ? key : null;
};

const getSubmissionSourceLabel = (source) => {
  if (!source) return 'Unknown';
  return LABELS[source] || source;
};

module.exports = {
  SUBMISSION_SOURCES,
  LABELS,
  normalizeSubmissionSource,
  getSubmissionSourceLabel,
};
