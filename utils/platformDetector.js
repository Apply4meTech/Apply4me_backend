/**
 * Utility function to detect job platform from URL
 * @param {string} url - The job URL
 * @returns {string} - The detected platform name
 */
function detectPlatformFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return 'custom';
  }

  const urlLower = url.toLowerCase();

  // LinkedIn
  if (urlLower.includes('linkedin.com/jobs') || urlLower.includes('linkedin.com/job')) {
    return 'linkedin';
  }

  // Indeed
  if (urlLower.includes('indeed.com') || urlLower.includes('indeed.co')) {
    return 'indeed';
  }

  // Glassdoor
  if (urlLower.includes('glassdoor.com')) {
    return 'glassdoor';
  }

  // Monster
  if (urlLower.includes('monster.com')) {
    return 'monster';
  }

  // ZipRecruiter
  if (urlLower.includes('ziprecruiter.com')) {
    return 'ziprecruiter';
  }

  // CareerBuilder
  if (urlLower.includes('careerbuilder.com')) {
    return 'careerbuilder';
  }

  // Dice
  if (urlLower.includes('dice.com')) {
    return 'dice';
  }

  // Stack Overflow Jobs
  if (urlLower.includes('stackoverflow.com/jobs')) {
    return 'stackoverflow';
  }

  // GitHub Jobs
  if (urlLower.includes('jobs.github.com')) {
    return 'github';
  }

  // AngelList / Wellfound
  if (urlLower.includes('angel.co') || urlLower.includes('wellfound.com')) {
    return 'wellfound';
  }

  // Remote.co
  if (urlLower.includes('remote.co')) {
    return 'remote.co';
  }

  // We Work Remotely
  if (urlLower.includes('weworkremotely.com')) {
    return 'weworkremotely';
  }

  // Company career pages (common patterns)
  if (urlLower.includes('/careers/') || urlLower.includes('/jobs/') || urlLower.includes('/job/')) {
    return 'company_website';
  }

  // Default to custom if no match
  return 'custom';
}

module.exports = { detectPlatformFromUrl };

