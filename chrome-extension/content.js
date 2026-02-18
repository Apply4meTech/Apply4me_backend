(function() {
  'use strict';

  // Configuration
  const API_URL = 'https://api.applyforme.com.au/api/jobs';
  const BUTTON_ID = 'applyforme-btn';

  // Remove button if it exists
  function removeButton() {
    const existingBtn = document.getElementById(BUTTON_ID);
    if (existingBtn) {
      existingBtn.remove();
      console.log('[Job Manager] Button removed');
    }
  }

  // Create button
  async function createButton() {
    try {
      // Check if we should show the button (URL check)
      if (!shouldShowButton()) {
        removeButton();
        return;
      }

      // Prevent duplicate
      if (document.getElementById(BUTTON_ID)) {
        console.log('[Job Manager] Button already exists');
        return;
      }

      // Make sure body exists
      if (!document.body) {
        console.log('[Job Manager] Body not ready, will retry');
        setTimeout(() => createButton(), 200);
        return;
      }

      console.log('[Job Manager] Creating button...');
      
      // Check authentication (but don't block button creation - will show error on save if not authenticated)
      let isAuthenticated = false;
      try {
        const authData = await chrome.storage.local.get(['token', 'user']);
        if (authData.token && authData.user) {
          isAuthenticated = true;
          console.log('[Job Manager] User authenticated');
        } else {
          console.log('[Job Manager] User not authenticated - button will show but save will require login');
        }
      } catch (error) {
        console.error('[Job Manager] Error checking auth:', error);
        // Continue to show button anyway
      }

      const btn = document.createElement('button');
      btn.id = BUTTON_ID;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1L10.5 6L16 7L12 11L12.5 16.5L8 14L3.5 16.5L4 11L0 7L5.5 6L8 1Z" fill="currentColor"/>
        </svg>
        <span>Assign to ApplyForMe</span>
      `;
      btn.className = 'job-manager-button';
      
      btn.addEventListener('click', handleSaveJob);
      
      // Always append to body as fixed position
      document.body.appendChild(btn);
      console.log('[Job Manager] Button created and added to page');
    } catch (error) {
      console.error('[Job Manager] Error creating button:', error);
      // Retry after a short delay
      setTimeout(() => {
        if (shouldShowButton() && !document.getElementById(BUTTON_ID)) {
          createButton();
        }
      }, 500);
    }
  }

  // Check if we're on an Indeed page
  function isIndeedPage() {
    const url = window.location.href;
    return url.includes('indeed.com');
  }

  // Extract job data from Indeed page
  function extractIndeedJobData() {
    const data = {
      title: '',
      company: '', // Empty string as requested for Indeed
      location: '', // Empty string as requested for Indeed
      jobUrl: window.location.href,
      platform: 'indeed',
      metadata: {},
      timestamp: new Date().toISOString()
    };

    console.log('[Job Manager] Extracting Indeed job data...');
    console.log('[Job Manager] Current URL:', window.location.href);

    // Extract job title from Indeed page
    // Indeed typically shows job title in h2 tags or specific classes
    const titleSelectors = [
      'h2[class*="jobTitle"]',
      'h2.jobTitle',
      'h2[data-testid="job-title"]',
      '.jobsearch-JobInfoHeader-title h2',
      '.jobsearch-JobInfoHeader-title',
      'h2 a[data-jk]',
      '[class*="jobTitle"] h2',
      '[class*="jobTitle"]',
      'h2'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Get text from element, preferring direct text over nested text
        let text = '';
        if (element.tagName === 'A' && element.innerText.trim()) {
          text = element.innerText.trim();
        } else if (element.innerText.trim()) {
          // For h2 elements, try to get text from the element itself or its first child link
          const link = element.querySelector('a');
          if (link && link.innerText.trim()) {
            text = link.innerText.trim();
          } else {
            text = element.innerText.trim();
          }
        }
        
        if (text) {
          // Clean up the text - remove extra whitespace
          const cleanText = text.replace(/\s+/g, ' ').trim();
          // Skip if it looks like a section heading or UI element
          const lowerText = cleanText.toLowerCase();
          if (cleanText.length > 3 && 
              cleanText.length < 200 &&
              !lowerText.includes('indeed') &&
              !lowerText.includes('job search') &&
              !lowerText.includes('profile insights')) {
            data.title = cleanText;
            console.log('[Job Manager] Found Indeed title:', data.title, 'using selector:', selector);
            break;
          }
        }
      }
    }

    // For Indeed, we keep company and location as empty strings as requested
    // Only extract the URL (which may have vjk parameter)
    const url = window.location.href;
    data.jobUrl = url;

    console.log('[Job Manager] Extracted Indeed data:', data);
    return data;
  }

  // Extract job data from LinkedIn page
  function extractJobData() {
    // Check if we're on Indeed first
    if (isIndeedPage()) {
      return extractIndeedJobData();
    }

    const data = {
      title: '',
      company: '',
      location: '',
      jobUrl: window.location.href,
      platform: 'linkedin',
      metadata: {},
      timestamp: new Date().toISOString()
    };

    console.log('[Job Manager] Extracting job data...');
    console.log('[Job Manager] Current URL:', window.location.href);

    // Check if we're on search results page or collections/recommended page
    const isSearchResults = window.location.href.includes('/jobs/search') || 
                            window.location.href.includes('/jobs/collections/recommended');
    const urlParams = new URLSearchParams(window.location.search);
    const currentJobId = urlParams.get('currentJobId');

    console.log('[Job Manager] isSearchResults:', isSearchResults, 'currentJobId:', currentJobId);

    // Try to extract from right panel (search results page or collections/recommended page)
    if (isSearchResults) {
      // Find the right panel/detail section
      const rightPanel = document.querySelector('.scaffold-layout__detail') ||
                        document.querySelector('.jobs-search__job-details') ||
                        document.querySelector('[data-test-id="job-details"]') ||
                        document.querySelector('main > div > div:last-child');
      
      if (rightPanel) {
        console.log('[Job Manager] Found right panel, extracting...');
        
        // Try to find title in right panel (skip section headings)
        if (!data.title) {
          const skipTexts = ['about the job', 'job description', 'show more', 'show less', 'apply now', 'save', 'easy apply', 'assessing your job match', 'your profile matches'];
          
          // First, try to find title in the top card area (usually before company)
          const topCard = rightPanel.querySelector('.jobs-details-top-card') ||
                         rightPanel.querySelector('.job-details-top-card') ||
                         rightPanel.querySelector('[class*="top-card"]') ||
                         rightPanel;
          
          // Look for h1 or h2 in top card first, but skip "Assessing your job match" and similar
          const topCardTitle = topCard.querySelector('h1') || topCard.querySelector('h2');
          if (topCardTitle) {
            const text = topCardTitle.innerText.trim();
            const lowerText = text.toLowerCase();
            // Skip "Assessing your job match" and similar assessment text
            if (text.length > 3 && 
                !skipTexts.some(skip => lowerText.includes(skip)) &&
                !lowerText.startsWith('about') &&
                !lowerText.startsWith('show') &&
                !lowerText.includes('assessing') &&
                !lowerText.includes('job match') &&
                !lowerText.includes('your profile matches')) {
              data.title = text;
              console.log('[Job Manager] Found title in top card:', data.title);
            }
          }
          
          // If still not found, search all headings but skip common section titles
          if (!data.title) {
            const allHeadings = rightPanel.querySelectorAll('h1, h2, h3');
            for (const heading of allHeadings) {
              const text = heading.innerText.trim();
              const lowerText = text.toLowerCase();
              
              // Skip section headings and common UI text
              if (text.length > 3 && 
                  text.length < 100 && // Job titles are usually shorter
                  !skipTexts.some(skip => lowerText.includes(skip)) &&
                  !lowerText.startsWith('about') &&
                  !lowerText.startsWith('show') &&
                  !lowerText.includes('description') &&
                  !lowerText.includes('qualification') &&
                  !lowerText.includes('assessing') &&
                  !lowerText.includes('job match') &&
                  !lowerText.includes('your profile matches')) {
                data.title = text;
                console.log('[Job Manager] Found title in right panel:', data.title);
                break;
              }
            }
          }
        }
        
        // Try to find company in right panel
        if (!data.company) {
          const companyInPanel = rightPanel.querySelector('a[href*="/company/"]') ||
                                rightPanel.querySelector('[class*="company"] a') ||
                                rightPanel.querySelector('a[data-control-name="job_poster"]');
          if (companyInPanel && companyInPanel.innerText.trim()) {
            data.company = companyInPanel.innerText.trim();
            console.log('[Job Manager] Found company in right panel:', data.company);
          }
        }
        
        // Try to find location in right panel
        if (!data.location) {
          // Try specific location selectors first
          let locationInPanel = rightPanel.querySelector('[class*="location"]') ||
                               rightPanel.querySelector('[class*="primary-description"]') ||
                               rightPanel.querySelector('.jobs-details-top-card__primary-description') ||
                               rightPanel.querySelector('.jobs-details-top-card__primary-description-without-tagline');
          
          // If not found, search for elements containing bullet separator or location text
          if (!locationInPanel) {
            const allElements = rightPanel.querySelectorAll('span, div, p, li');
            for (const el of allElements) {
              const text = el.innerText.trim();
              // Look for location patterns: contains ·, or location keywords, or country names
              if ((text.includes('·') || text.match(/\b(India|Remote|Hybrid|On-site|Gurugram|Bangalore|Delhi|Noida|Hyderabad|Mumbai|Pune|Chennai|Kolkata|United States|USA|UK|Canada|Australia|Germany|France|Spain|Italy|Netherlands|Sweden|Norway|Denmark|Finland|Poland|Singapore|Japan|China|South Korea|Brazil|Mexico|Argentina|South Africa|New Zealand)\b/i)) && 
                  text.length < 200 && 
                  text.length > 3) {
                locationInPanel = el;
                break;
              }
            }
          }
          
          if (locationInPanel && locationInPanel.innerText.trim()) {
            const text = locationInPanel.innerText.trim();
            // Split by bullet points
            const parts = text.split('·').map(p => p.trim()).filter(p => p);
            
            // Find the location part (usually the last meaningful part)
            let location = '';
            for (let i = parts.length - 1; i >= 0; i--) {
              const part = parts[i];
              // Skip dates, applicant counts, etc.
              if (!part.match(/^\d+\s*(day|days|month|months|ago|applicants?)$/i) &&
                  !part.match(/^Over\s+\d+\s+applicants?$/i) &&
                  !part.match(/^[0-9]+\s*(day|days|month|months|ago)$/i) &&
                  part.length > 2) {
                location = part;
                break;
              }
            }
            
            // If no location found in parts, try the whole text
            if (!location && text.length < 100) {
              location = text.replace(/^[0-9]+\s*(day|days|month|months|ago|applicants?)\s*·?\s*/i, '').trim();
              location = location.replace(/^Over\s+\d+\s+applicants?\s*·?\s*/i, '').trim();
            }
            
            if (location) {
              data.location = location;
              console.log('[Job Manager] Found location in right panel:', data.location);
            }
          }
        }
      }
    }

    // Try to get job URL from selected job
    if (isSearchResults && currentJobId) {
      // Try to find the job link in the selected job card
      const jobCard = document.querySelector(`[data-job-id="${currentJobId}"]`) ||
                      document.querySelector(`a[href*="/jobs/view/${currentJobId}"]`)?.closest('li') ||
                      document.querySelector('.jobs-search-results__list-item--active') ||
                      document.querySelector('.scaffold-layout__list-container li[data-occludable-job-id]') ||
                      document.querySelector('li[data-occludable-job-id]') ||
                      document.querySelector('.jobs-search-results__list-item');
      
      if (jobCard) {
        // Try to extract from job card (only if we don't have title yet)
        if (!data.title) {
          const cardTitle = jobCard.querySelector('.job-search-card__title') ||
                           jobCard.querySelector('h3.base-search-card__title') ||
                           jobCard.querySelector('a[data-control-name="job_search_job_title"]') ||
                           jobCard.querySelector('h3') ||
                           jobCard.querySelector('a[href*="/jobs/view/"]');
          if (cardTitle && cardTitle.innerText.trim()) {
            const text = cardTitle.innerText.trim();
            if (text.length > 3 && text.length < 200) {
              data.title = text;
              console.log('[Job Manager] Found title from card:', data.title);
            }
          }
        }

        const cardCompany = jobCard.querySelector('.job-search-card__subtitle') ||
                           jobCard.querySelector('h4.base-search-card__subtitle') ||
                           jobCard.querySelector('a[data-control-name="job_search_job_poster"]');
        if (cardCompany) {
          data.company = cardCompany.innerText.trim();
          console.log('[Job Manager] Found company from card:', data.company);
        }

        const cardLocation = jobCard.querySelector('.job-search-card__location') ||
                            jobCard.querySelector('.job-search-card__metadata-wrapper') ||
                            jobCard.querySelector('.base-search-card__metadata') ||
                            jobCard.querySelector('[class*="location"]') ||
                            jobCard.querySelector('[class*="metadata"]');
        if (cardLocation) {
          let locationText = cardLocation.innerText.trim();
          // Clean up location text - remove extra whitespace and newlines
          locationText = locationText.replace(/\s+/g, ' ').trim();
          // Remove common prefixes
          locationText = locationText.replace(/^[0-9]+\s*(day|days|month|months|ago|applicants?)\s*·?\s*/i, '').trim();
          if (locationText && locationText.length > 0) {
            data.location = locationText;
            console.log('[Job Manager] Found location from card:', data.location);
          }
        }

        // Try to get the actual job view URL
        const jobLink = jobCard.querySelector(`a[href*="/jobs/view/${currentJobId}"]`) ||
                       jobCard.querySelector('a[data-control-name="job_search_job_title"]');
        if (jobLink && jobLink.href) {
          data.jobUrl = jobLink.href.split('?')[0]; // Remove query params
          console.log('[Job Manager] Found job URL:', data.jobUrl);
        } else {
          // Construct URL from job ID
          data.jobUrl = `https://www.linkedin.com/jobs/view/${currentJobId}`;
        }
      }
    }

    // Try multiple selectors for title (detail page or right panel)
    if (!data.title) {
      const titleSelectors = [
        // Search results right panel - prioritize these
        '.jobs-details-top-card__job-title h1',
        '.jobs-details-top-card h1',
        '.scaffold-layout__detail h1',
        '.jobs-search__job-details h1',
        '.job-details-top-card h1',
        // Standard detail page - prioritize these
        'h1.job-details-jobs-unified-top-card__job-title',
        'h1.jobs-details-top-card__job-title',
        '.job-details-jobs-unified-top-card__job-title',
        'h1[data-test-id="job-title"]',
        'h1.job-details__job-title',
        '.jobs-details__job-title h1',
        'h1.jobs-details-top-card__job-title-link',
        // Look for title in main content area
        'main .jobs-details-top-card h1',
        'main .job-details-jobs-unified-top-card h1',
        // Generic fallback (but check it's not a section heading)
        'main h1:first-of-type',
        'h1:first-of-type'
      ];
      
      const skipTexts = ['about the job', 'job description', 'show more', 'show less', 'apply now', 'save', 'linkedin', 'assessing your job match', 'your profile matches'];
      
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.trim()) {
          const text = element.innerText.trim();
          const lowerText = text.toLowerCase();
          
          // Skip generic headings and section titles
          // Also skip if it looks like a job ID number
          if (text.length > 3 && 
              text.length < 150 && // Job titles shouldn't be too long
              !skipTexts.some(skip => lowerText.includes(skip)) &&
              !lowerText.startsWith('about') &&
              !lowerText.startsWith('show') &&
              !lowerText.includes('assessing') &&
              !lowerText.includes('job match') &&
              !lowerText.includes('your profile matches') &&
              !text.match(/^Job\s*#?\d+$/i) && // Don't accept "Job #123" format
              !text.match(/^\d+$/)) { // Don't accept pure numbers
            data.title = text;
            console.log('[Job Manager] Found title:', data.title, 'using selector:', selector);
            break;
          }
        }
      }
    }

    // Try multiple selectors for company
    if (!data.company) {
      const companySelectors = [
        // Search results right panel
        '.jobs-search__job-details a[data-control-name="job_poster"]',
        '.jobs-details-top-card__company-name a',
        '.jobs-details-top-card a[href*="/company/"]',
        '.scaffold-layout__detail a[href*="/company/"]',
        // Standard detail page
        '.job-details-jobs-unified-top-card__company-name a',
        'a[data-test-id="job-poster"]',
        '.jobs-details-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name',
        '.job-details__company-name a',
        'a[data-control-name="job_poster"]',
        '.jobs-details__company-name a',
        '.jobs-details-top-card__company-name-link',
        // Generic company link
        'main a[href*="/company/"]'
      ];
      
      for (const selector of companySelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.trim()) {
          const text = element.innerText.trim();
          // Make sure it's not too long (likely not company name)
          if (text.length < 100) {
            data.company = text;
            console.log('[Job Manager] Found company:', data.company, 'using selector:', selector);
            break;
          }
        }
      }
    }

    // Try multiple selectors for location
    if (!data.location) {
      const locationSelectors = [
        // Search results right panel - prioritize these
        '.jobs-details-top-card__primary-description-without-tagline',
        '.jobs-details-top-card__primary-description',
        '.scaffold-layout__detail .jobs-details-top-card__primary-description',
        // Standard detail page - prioritize these
        '.job-details-jobs-unified-top-card__primary-description-without-tagline',
        '.job-details-jobs-unified-top-card__bullet',
        '[data-test-id="job-location"]',
        '.jobs-unified-top-card__primary-description',
        '.jobs-details__primary-description',
        // Additional selectors
        '.jobs-details-top-card__job-info',
        '.job-details-jobs-unified-top-card__job-info',
        '[class*="job-info"]',
        '[class*="location"]'
      ];
      
      for (const selector of locationSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.trim()) {
          const text = element.innerText.trim();
          
          // Extract location (usually after company name, separated by ·)
          const parts = text.split('·').map(p => p.trim()).filter(p => p);
          
          // Find the location part (usually the last meaningful part)
          let location = '';
          for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            
            // Skip dates, applicant counts, job types, etc.
            if (!part.match(/^\d+\s*(day|days|month|months|ago|applicants?)$/i) &&
                !part.match(/^Over\s+\d+\s+applicants?$/i) &&
                !part.match(/^[0-9]+\s*(day|days|month|months|ago)$/i) &&
                !part.toLowerCase().includes('applicant') &&
                !part.toLowerCase().includes('full-time') &&
                !part.toLowerCase().includes('part-time') &&
                !part.toLowerCase().includes('contract') &&
                !part.toLowerCase().includes('remote') && // Skip if it's just "Remote" without location
                !part.toLowerCase().includes('hybrid') &&
                !part.toLowerCase().includes('on-site') &&
                !part.toLowerCase().includes('responses managed') &&
                part.length > 2 &&
                part.length < 150) { // Location shouldn't be too long
              
              // Check if it looks like a location (contains city, state, or country)
              const countries = /India|United States|USA|UK|Canada|Australia|Germany|France|Spain|Italy|Netherlands|Sweden|Norway|Denmark|Finland|Poland|Singapore|Japan|China|South Korea|Brazil|Mexico|Argentina|South Africa|New Zealand/i;
              const states = /Karnataka|Maharashtra|Tamil Nadu|West Bengal|Gujarat|Rajasthan|Madhya Pradesh|Punjab|Haryana|Uttar Pradesh|Andhra Pradesh|Telangana|Kerala|Odisha|Assam|Jharkhand|Chhattisgarh|Himachal Pradesh|Uttarakhand|Goa|Manipur|Meghalaya|Mizoram|Nagaland|Sikkim|Tripura|Arunachal Pradesh/i;
              
              if (part.match(countries) || part.match(states) || 
                  part.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z][a-z]+,?\s*[A-Z][a-z]+/)) {
                location = part;
                break;
              }
            }
          }
          
          // If no location found in parts, try to extract from whole text
          // Look for pattern like "City, State, Country"
          if (!location && text.length < 200) {
            const countries = /India|United States|USA|UK|Canada|Australia|Germany|France|Spain|Italy|Netherlands|Sweden|Norway|Denmark|Finland|Poland|Singapore|Japan|China|South Korea|Brazil|Mexico|Argentina|South Africa|New Zealand/i;
            const states = /Karnataka|Maharashtra|Tamil Nadu|West Bengal|Gujarat|Rajasthan|Madhya Pradesh|Punjab|Haryana|Uttar Pradesh|Andhra Pradesh|Telangana|Kerala|Odisha|Assam|Jharkhand|Chhattisgarh|Himachal Pradesh|Uttarakhand|Goa|Manipur|Meghalaya|Mizoram|Nagaland|Sikkim|Tripura|Arunachal Pradesh/i;
            
            // Try to find location pattern
            const locationMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z][a-z]+,?\s*(?:India|United States|USA|UK|Canada|Australia|Germany|France|Spain|Italy|Netherlands|Sweden|Norway|Denmark|Finland|Poland|Singapore|Japan|China|South Korea|Brazil|Mexico|Argentina|South Africa|New Zealand))/i);
            if (locationMatch) {
              location = locationMatch[1].trim();
            } else if (text.match(countries) || text.match(states)) {
              // Extract the part containing country/state
              const parts = text.split(',').map(p => p.trim());
              for (let i = parts.length - 1; i >= 0; i--) {
                if (parts[i].match(countries) || parts[i].match(states)) {
                  // Take this part and maybe the one before it
                  if (i > 0 && parts[i-1].length < 50) {
                    location = `${parts[i-1]}, ${parts[i]}`;
                  } else {
                    location = parts[i];
                  }
                  break;
                }
              }
            } else {
              // Fallback: clean up and take reasonable length
              location = text.replace(/^[0-9]+\s*(day|days|month|months|ago|applicants?)\s*·?\s*/i, '').trim();
              location = location.replace(/^Over\s+\d+\s+applicants?\s*·?\s*/i, '').trim();
              // If it's still too long, take first reasonable part
              if (location.length > 100) {
                const firstPart = location.split(',')[0];
                if (firstPart && firstPart.length < 100) {
                  location = firstPart.trim();
                }
              }
            }
          }
          
          if (location && location.length > 0 && location.length < 150) {
            data.location = location;
            console.log('[Job Manager] Found location:', data.location, 'using selector:', selector);
            break;
          }
        }
      }
    }

    // Extract description if available
    const descriptionEl = document.querySelector('.jobs-description-content__text') ||
                          document.querySelector('.jobs-box__html-content') ||
                          document.querySelector('[data-test-id="job-description"]') ||
                          document.querySelector('.jobs-description__text') ||
                          document.querySelector('.jobs-description__text--text');
    
    if (descriptionEl) {
      data.metadata.description = descriptionEl.innerText.substring(0, 500);
    }

    // Always construct proper job URL from jobId if available
    if (currentJobId) {
      data.jobUrl = `https://www.linkedin.com/jobs/view/${currentJobId}`;
    } else if (data.jobUrl.includes('search-results') || data.jobUrl.includes('collections/recommended')) {
      // Try to extract jobId from URL if not in params
      const jobIdMatch = data.jobUrl.match(/currentJobId=(\d+)/);
      if (jobIdMatch) {
        data.jobUrl = `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}`;
      }
    }

    console.log('[Job Manager] Extracted data:', data);
    return data;
  }

  // Handle save job
  async function handleSaveJob() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    // Disable button and show loading
    btn.disabled = true;
    btn.innerHTML = '<span>Saving...</span>';

    try {
      const jobData = extractJobData();
      const isIndeed = isIndeedPage();

      // More lenient validation - allow saving even if some fields are missing
      // If we have a jobId, we can save with minimal data
      const urlParams = new URLSearchParams(window.location.search);
      const currentJobId = urlParams.get('currentJobId');
      
      if (!jobData.title && !jobData.company && !currentJobId) {
        if (isIndeed) {
          throw new Error('Could not extract job details. Please make sure a job is selected on Indeed.');
        } else {
          const isSearchPage = window.location.href.includes('/jobs/search') || 
                               window.location.href.includes('/jobs/collections/recommended');
          if (isSearchPage) {
            throw new Error('Please click on a job in the list first to select it, then click "Assign to ApplyForMe". Or navigate to the job detail page.');
          } else {
            throw new Error('Could not extract job details. Please make sure you are on a job detail page.');
          }
        }
      }

      // Set defaults if missing (but we have jobId)
      // Only set default title if we really can't find it
      if (!jobData.title || jobData.title.trim() === '') {
        if (isIndeed) {
          // For Indeed, try to get title from Indeed-specific selectors
          const titleEl = document.querySelector('h2[class*="jobTitle"]') ||
                         document.querySelector('h2.jobTitle') ||
                         document.querySelector('h2[data-testid="job-title"]') ||
                         document.querySelector('.jobsearch-JobInfoHeader-title h2') ||
                         document.querySelector('.jobsearch-JobInfoHeader-title') ||
                         document.querySelector('h2');
          if (titleEl && titleEl.innerText && titleEl.innerText.trim().length > 3) {
            jobData.title = titleEl.innerText.trim();
          } else {
            jobData.title = 'Job title Not found';
          }
        } else {
          // For LinkedIn, try LinkedIn-specific selectors
          const titleEl = document.querySelector('h1.job-details-jobs-unified-top-card__job-title, h1.jobs-details-top-card__job-title, .jobs-details-top-card h1, main h1:first-of-type');
          if (titleEl && titleEl.innerText && titleEl.innerText.trim().length > 3) {
            jobData.title = titleEl.innerText.trim();
          } else if (currentJobId) {
            jobData.title = 'Job title Not found';
          } else {
            jobData.title = 'Job title Not found';
          }
        }
      }
      
      // For Indeed, keep company and location as empty strings (as requested)
      // For LinkedIn, set defaults if missing
      if (!isIndeed) {
        if (!jobData.company || jobData.company.trim() === '') {
          jobData.company = 'Company name Not found';
        }
      } else {
        // Ensure Indeed keeps empty strings for company and location
        jobData.company = '';
        jobData.location = '';
      }
      
      // Get authentication token from storage
      const authData = await chrome.storage.local.get(['token', 'user']);
      const token = authData.token;
      const user = authData.user;
      
      if (!token || !user) {
        throw new Error('Please log in to ApplyForMe dashboard first. Click the extension icon to login. This extension is designed for ApplyForMe customers only.');
      }
      
      // Extract userId from user object
      const userId = user.id || user._id;
      if (!userId) {
        throw new Error('User information not found. Please log in again.');
      }
      
      jobData.userId = userId;

      // Log what we're saving
      console.log('[Job Manager] Saving job data:', JSON.stringify(jobData, null, 2));
      console.log('[Job Manager] User ID:', userId);

      // Ensure location is not empty string if we couldn't find it (only for LinkedIn)
      if (!isIndeed) {
        if (!jobData.location || jobData.location.trim() === '') {
          jobData.location = 'Not specified';
        }
      }

      // Send to API with Authorization header
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(jobData)
      });

      const result_data = await response.json();

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          // Clear invalid auth data
          await chrome.storage.local.remove(['token', 'user', 'lastAuthCheck']);
          throw new Error('Session expired. Please log in again to ApplyForMe dashboard.');
        }
        throw new Error(result_data.error || 'Failed to save job');
      }

      // Success feedback
      btn.innerHTML = '<span>✓ Assigned!</span>';
      btn.style.background = '#10b981';
      
      // Reset after 2 seconds
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L10.5 6L16 7L12 11L12.5 16.5L8 14L3.5 16.5L4 11L0 7L5.5 6L8 1Z" fill="currentColor"/>
          </svg>
          <span>Assign to ApplyForMe</span>
        `;
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);

      // Show notification
      showNotification('Job assigned to ApplyForMe successfully!', 'success');

    } catch (error) {
      console.error('Error saving job:', error);
      btn.innerHTML = '<span>✗ Error</span>';
      btn.style.background = '#ef4444';
      showNotification(error.message || 'Failed to save job', 'error');
      
      // Reset after 3 seconds
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L10.5 6L16 7L12 11L12.5 16.5L8 14L3.5 16.5L4 11L0 7L5.5 6L8 1Z" fill="currentColor"/>
          </svg>
          <span>Assign to ApplyForMe</span>
        `;
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    }
  }

  // Show notification
  function showNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.getElementById('job-manager-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'job-manager-notification';
    notification.className = `job-manager-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Check if we're on a LinkedIn job detail page (where button should appear)
  function shouldShowButton() {
    const url = window.location.href;
    
    // Handle Indeed pages
    if (isIndeedPage()) {
      const urlParams = new URLSearchParams(window.location.search);
      const hasVjkParam = urlParams.has('vjk');
      const hasJkParam = urlParams.has('jk');
      const fromParam = urlParams.get('from');
      
      // Show button on /viewjob?jk=... pages
      if (url.includes('/viewjob') && hasJkParam) {
        return true;
      }
      
      // Show button if vjk parameter exists (indicates a job is selected)
      // This works for both from=gnav-homepage&vjk=... and from=gnav-viewjob&vjk=...
      // Show immediately when vjk exists, don't wait for content to load
      if (hasVjkParam) {
        return true;
      }
      
      // Don't show on Indeed homepage without vjk parameter
      if (url === 'https://www.indeed.com/' || 
          url === 'https://in.indeed.com/' ||
          url.match(/^https:\/\/(www\.|in\.)?indeed\.com\/?(\?.*)?$/)) {
        // Only hide if there's no vjk parameter
        if (!hasVjkParam && !hasJkParam) {
          return false;
        }
      }
      
      // Default: don't show for other Indeed pages without job selection
      return false;
    }
    
    // Handle LinkedIn pages (existing logic)
    // Don't show on main jobs listing page
    if (url === 'https://www.linkedin.com/jobs/' || 
        url === 'https://www.linkedin.com/jobs' ||
        url.match(/^https:\/\/www\.linkedin\.com\/jobs\/?$/)) {
      return false;
    }
    
    // Show on job detail page (/jobs/view/{id})
    if (url.includes('/jobs/view/')) {
      return true;
    }
    
    // Show on search results page ONLY if a job is selected (has currentJobId)
    if (url.includes('/jobs/search-results')) {
      const urlParams = new URLSearchParams(window.location.search);
      const currentJobId = urlParams.get('currentJobId');
      
      // Only show if currentJobId exists
      if (currentJobId) {
        // Very lenient check - if we have currentJobId, show button
        // The content might still be loading, but we'll show it anyway
        // The retry mechanism will ensure it stays visible once content fully loads
        
        // Check if job details panel exists
        const jobDetailsPanel = document.querySelector('.scaffold-layout__detail') ||
                               document.querySelector('.jobs-search__job-details') ||
                               document.querySelector('[data-test-id="job-details"]') ||
                               document.querySelector('main .scaffold-layout__detail') ||
                               document.querySelector('main > div > div:last-child');
        
        // If panel exists, definitely show button
        if (jobDetailsPanel) {
          return true;
        }
        
        // Even if panel doesn't exist yet, if we have currentJobId, show button
        // This handles the case where content is still loading after page load/refresh
        // We'll keep checking and the button will remain visible once content loads
        return true;
      }
      return false;
    }
    
    // Show on collections/recommended page (Jobs based on your activity) if a job is selected
    // Also handle other collections pages like /jobs/collections/saved/, etc.
    if (url.includes('/jobs/collections/')) {
      const urlParams = new URLSearchParams(window.location.search);
      const currentJobId = urlParams.get('currentJobId');
      
      // Only show if currentJobId exists
      if (currentJobId) {
        // Very lenient check - if we have currentJobId, show button
        // The content might still be loading, but we'll show it anyway
        // The retry mechanism will ensure it stays visible once content fully loads
        
        // Check if job details panel exists
        const jobDetailsPanel = document.querySelector('.scaffold-layout__detail') ||
                               document.querySelector('.jobs-search__job-details') ||
                               document.querySelector('[data-test-id="job-details"]') ||
                               document.querySelector('main .scaffold-layout__detail') ||
                               document.querySelector('main > div > div:last-child');
        
        // If panel exists, definitely show button
        if (jobDetailsPanel) {
          return true;
        }
        
        // Even if panel doesn't exist yet, if we have currentJobId, show button
        // This handles the case where content is still loading after page load/refresh
        // We'll keep checking and the button will remain visible once content loads
        return true;
      }
      return false;
    }
    
    // Fallback: check for job detail elements
    const hasJobDetails = document.querySelector('[data-test-id="job-poster"]') ||
                         document.querySelector('.jobs-details-top-card') ||
                         document.querySelector('.job-details-jobs-unified-top-card');
    
    return !!hasJobDetails;
  }
  
  // Check if we're on any LinkedIn jobs page (for initialization)
  function isLinkedInJobsPage() {
    const url = window.location.href;
    return url.includes('linkedin.com/jobs') || url.includes('linkedin.com/job');
  }

  // Check if we're on any Indeed page (for initialization)
  function isIndeedJobsPage() {
    const url = window.location.href;
    return url.includes('indeed.com');
  }

  // Check if we're on any supported job platform
  function isSupportedJobsPage() {
    return isLinkedInJobsPage() || isIndeedJobsPage();
  }

  // Initialize or update button based on current page state
  function init() {
    console.log('[Job Manager] Initializing...', window.location.href);
    
    if (!isSupportedJobsPage()) {
      console.log('[Job Manager] Not a supported jobs page, removing button if exists');
      removeButton();
      return;
    }

    // Check if we should show button and create/remove accordingly
    async function checkAndUpdateButton() {
      try {
        if (shouldShowButton()) {
          if (!document.getElementById(BUTTON_ID)) {
            console.log('[Job Manager] Should show button, creating...');
            await createButton();
          } else {
            console.log('[Job Manager] Button already exists');
          }
        } else {
          console.log('[Job Manager] Should not show button, removing if exists');
          removeButton();
        }
      } catch (error) {
        console.error('[Job Manager] Error in checkAndUpdateButton:', error);
        // Retry once after a short delay
        setTimeout(async () => {
          try {
            if (shouldShowButton() && !document.getElementById(BUTTON_ID)) {
              await createButton();
            }
          } catch (retryError) {
            console.error('[Job Manager] Retry also failed:', retryError);
          }
        }, 500);
      }
    }
    
    // Make checkAndUpdateButton available globally for reuse
    window.checkAndUpdateButton = checkAndUpdateButton;

    // Try to create/update button immediately
    if (document.body) {
      checkAndUpdateButton();
    } else {
      // Wait for body
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          checkAndUpdateButton();
          bodyObserver.disconnect();
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true });
    }

    // Multiple retry attempts for dynamic content (with increasing delays)
    // Start with shorter delays for faster initial appearance
    const retries = [100, 300, 600, 1200, 2000, 3000, 5000];
    retries.forEach(delay => {
      setTimeout(() => {
        checkAndUpdateButton();
      }, delay);
    });

    // Watch for URL changes using multiple methods
    let lastUrl = location.href;
    
    // Method 1: Listen to popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          console.log('[Job Manager] URL changed (popstate), re-checking...');
          // Check immediately and then again after content loads
          checkAndUpdateButton();
          setTimeout(checkAndUpdateButton, 300);
          setTimeout(checkAndUpdateButton, 800);
        }
      }, 50);
    });

    // Method 2: Watch for pushState/replaceState (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      const result = originalPushState.apply(history, args);
      setTimeout(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          console.log('[Job Manager] URL changed (pushState), re-checking...');
          // Check multiple times to ensure button appears
          checkAndUpdateButton();
          setTimeout(checkAndUpdateButton, 200);
          setTimeout(checkAndUpdateButton, 500);
          setTimeout(checkAndUpdateButton, 1000);
          // Also trigger full re-initialization
          if (window.startInitialization) {
            setTimeout(() => window.startInitialization(), 100);
          }
        }
      }, 10); // Very short delay
      return result;
    };
    
    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(history, args);
      setTimeout(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          console.log('[Job Manager] URL changed (replaceState), re-checking...');
          checkAndUpdateButton();
          setTimeout(checkAndUpdateButton, 200);
          setTimeout(checkAndUpdateButton, 500);
          setTimeout(checkAndUpdateButton, 1000);
          // Also trigger full re-initialization
          if (window.startInitialization) {
            setTimeout(() => window.startInitialization(), 100);
          }
        }
      }, 10);
      return result;
    };

    // Method 3: Watch DOM changes for dynamic content loading (with debounce)
    let checkTimeout = null;
    const contentObserver = new MutationObserver((mutations) => {
        // Only check if we're on a jobs page
        if (isSupportedJobsPage()) {
        // Check if mutations are relevant (added nodes that might be job content)
        const hasRelevantChanges = mutations.some(mutation => {
          if (mutation.addedNodes.length > 0) {
            // Check if any added node might be job-related
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) { // Element node
                // Convert className to string safely
                const className = String(node.className || '');
                const classList = node.classList;
                
                // Check if node or any child has job-related classes
                if (className.includes('job') || 
                    className.includes('detail') || 
                    className.includes('scaffold-layout') ||
                    (classList && (
                      classList.contains('job') ||
                      classList.contains('detail') ||
                      classList.contains('scaffold-layout')
                    ))) {
                  return true;
                }
                
                // Also check child elements quickly
                if (node.querySelector && (
                    node.querySelector('[class*="job"]') ||
                    node.querySelector('[class*="detail"]') ||
                    node.querySelector('[class*="scaffold-layout"]')
                  )) {
                  return true;
                }
              }
            }
          }
          return false;
        });
        
        // Debounce to avoid excessive checks, but check faster if relevant changes
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(() => {
          checkAndUpdateButton();
        }, hasRelevantChanges ? 150 : 300);
      }
    });
    
    // Observe changes to the main content area
    if (document.body) {
      contentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false // Only watch for structure changes, not attribute changes
      });
    }

    // Method 4: Periodic check (fallback for edge cases)
    // More frequent checks initially, then less frequent
    let checkCount = 0;
    const intervalId = setInterval(() => {
      if (isSupportedJobsPage()) {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          checkAndUpdateButton();
        } else {
          // Even if URL hasn't changed, check button state (content might have loaded)
          checkAndUpdateButton();
        }
        checkCount++;
        // After 10 checks (20 seconds), reduce frequency to every 3 seconds
        if (checkCount > 10) {
          clearInterval(intervalId);
          setInterval(() => {
            if (isSupportedJobsPage()) {
              const currentUrl = location.href;
              if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                checkAndUpdateButton();
              } else {
                checkAndUpdateButton();
              }
            }
          }, 3000);
        }
      }
    }, 2000);

    // Expose debug function to window
    window.jobManagerDebug = () => {
      console.log('[Job Manager] Debug Info:');
      console.log('- URL:', window.location.href);
      console.log('- Button exists:', !!document.getElementById(BUTTON_ID));
      console.log('- Is LinkedIn page:', isLinkedInJobsPage());
      console.log('- Is Indeed page:', isIndeedJobsPage());
      console.log('- Is supported page:', isSupportedJobsPage());
      console.log('- Should show button:', shouldShowButton());
      console.log('- Body exists:', !!document.body);
      checkAndUpdateButton();
    };
  }

  // Initialize immediately - don't wait for events
  // This ensures the script runs as soon as it's injected
  function startInitialization() {
    // Run immediately
    init();
    
    // Run multiple times with increasing delays to catch all scenarios
    const initDelays = [50, 100, 200, 500, 1000, 2000];
    initDelays.forEach(delay => {
      setTimeout(init, delay);
    });
  }

  // Start initialization based on document state
  if (document.readyState === 'loading') {
    // If still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', startInitialization);
  } else {
    // DOM is already ready, run immediately
    startInitialization();
  }

  // Also run on page load (for full page reloads)
  window.addEventListener('load', () => {
    setTimeout(init, 100);
  });

  // CRITICAL: Watch for URL changes continuously
  // This is the key to handling SPA navigation - polls every 300ms for faster detection
  let currentUrl = window.location.href;
  const urlCheckInterval = setInterval(() => {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      currentUrl = newUrl;
      console.log('[Job Manager] URL changed detected via polling:', newUrl);
      // Immediately check and update button
      if (window.checkAndUpdateButton) {
        window.checkAndUpdateButton();
      }
      // Also re-initialize for comprehensive coverage
      setTimeout(() => {
        init();
      }, 100);
    } else {
      // Even if URL hasn't changed, periodically check button state
      // This handles cases where content loads after URL change
      if (window.checkAndUpdateButton && isSupportedJobsPage()) {
        window.checkAndUpdateButton();
      }
    }
  }, 300); // Check every 300ms for faster response

  // Also run immediately
  startInitialization();
  
  // Make startInitialization available for history API hooks
  window.startInitialization = startInitialization;
  
  // Listen for storage changes (when auth is updated)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      // If auth was added/updated, re-check button visibility
      if (changes.token && changes.token.newValue && changes.user && changes.user.newValue) {
        console.log('[Job Manager] Auth updated - checking button visibility');
        if (window.checkAndUpdateButton) {
          window.checkAndUpdateButton();
        }
      }
      // Note: We don't remove button on logout - let user see it and get error message when trying to save
    }
  });
  
  // Listen for page visibility changes (when user switches back to tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isSupportedJobsPage()) {
      console.log('[Job Manager] Page visible again, checking button');
      setTimeout(() => {
        if (window.checkAndUpdateButton) {
          window.checkAndUpdateButton();
        }
      }, 200);
    }
  });

  // Listen for focus events (when user clicks back into the tab)
  window.addEventListener('focus', () => {
    if (isSupportedJobsPage()) {
      console.log('[Job Manager] Window focused, checking button');
      setTimeout(() => {
        if (window.checkAndUpdateButton) {
          window.checkAndUpdateButton();
        }
      }, 200);
    }
  });
})();
