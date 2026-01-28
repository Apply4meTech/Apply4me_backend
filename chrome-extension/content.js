(function() {
  'use strict';

  // Configuration
  const API_URL = 'http://localhost:4000/api/jobs';
  const BUTTON_ID = 'job-manager-btn';

  // Create button
  function createButton() {
    // Prevent duplicate
    if (document.getElementById(BUTTON_ID)) {
      console.log('[Job Manager] Button already exists');
      return;
    }

    console.log('[Job Manager] Creating button...');

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1L10.5 6L16 7L12 11L12.5 16.5L8 14L3.5 16.5L4 11L0 7L5.5 6L8 1Z" fill="currentColor"/>
      </svg>
      <span>Save to Job Manager</span>
    `;
    btn.className = 'job-manager-button';
    
    btn.addEventListener('click', handleSaveJob);
    
    // Always append to body as fixed position
    document.body.appendChild(btn);
    console.log('[Job Manager] Button created and added to page');
  }

  // Extract LinkedIn user information
  function extractLinkedInUserInfo() {
    const userInfo = {
      name: '',
      profileUrl: '',
      email: '',
      phone: ''
    };

    try {
      console.log('[Job Manager] Starting LinkedIn user info extraction...');
      
      // Method 1: Try to get from global navigation (most reliable)
      // LinkedIn uses various selectors for the profile link
      const navSelectors = [
        'nav[aria-label="Main navigation"]',
        'nav.global-nav',
        'header nav',
        'nav',
        '[role="navigation"]'
      ];
      
      let globalNav = null;
      for (const selector of navSelectors) {
        globalNav = document.querySelector(selector);
        if (globalNav) break;
      }
      
      if (globalNav) {
        console.log('[Job Manager] Found navigation, searching for profile link...');
        // Look for profile link in nav - try multiple patterns
        const profileLinkSelectors = [
          'a[href*="/in/"]:not([href*="/jobs"]):not([href*="/company"]):not([href*="/search"])',
          'a[data-control-name="nav.settings_signout"]',
          'a[href^="/in/"]',
          '.global-nav__me-photo',
          '.global-nav__primary-link-me a'
        ];
        
        let profileLink = null;
        for (const selector of profileLinkSelectors) {
          profileLink = globalNav.querySelector(selector);
          if (profileLink && profileLink.href && profileLink.href.includes('/in/')) {
            break;
          }
        }
        
        if (profileLink && profileLink.href) {
          // Get profile URL
          const href = profileLink.href;
          if (href.includes('/in/')) {
            userInfo.profileUrl = href.split('?')[0].split('#')[0];
            console.log('[Job Manager] Found profile URL:', userInfo.profileUrl);
          }
          
          // Try to get name from the link or nearby elements
          let nameText = profileLink.innerText?.trim() || 
                        profileLink.getAttribute('aria-label')?.replace(/Profile of\s*/i, '')?.replace(/View\s+profile\s+of\s*/i, '')?.trim() ||
                        profileLink.textContent?.trim() ||
                        profileLink.title?.trim();
          
          // If not found, look in parent or sibling elements
          if (!nameText || nameText.length < 2) {
            const parent = profileLink.closest('div, li, span, button');
            if (parent) {
              // Try multiple child selectors
              const nameSelectors = ['span', 'div', 'h3', 'h4', 'p', '[class*="name"]'];
              for (const sel of nameSelectors) {
                const nameEl = parent.querySelector(sel);
                if (nameEl) {
                  const text = nameEl.innerText?.trim() || nameEl.textContent?.trim();
                  if (text && text.length > 1 && text.length < 100) {
                    nameText = text;
                    break;
                  }
                }
              }
              // If still not found, try parent's text
              if (!nameText || nameText.length < 2) {
                nameText = parent.innerText?.trim() || parent.textContent?.trim();
              }
            }
          }
          
          if (nameText && nameText.length > 1 && nameText.length < 100) {
            // Filter out common non-name text
            const lowerText = nameText.toLowerCase();
            if (!lowerText.includes('profile') && 
                !lowerText.includes('sign out') &&
                !lowerText.includes('settings') &&
                !lowerText.includes('view profile') &&
                !lowerText.includes('me') &&
                !lowerText.match(/^\d+$/) && // Not just numbers
                (nameText.match(/^[A-Z][a-z]+\s+[A-Z]/) || nameText.match(/^[A-Z][a-z]+/))) { // Should have proper name format
              userInfo.name = nameText;
              console.log('[Job Manager] Found name:', userInfo.name);
            }
          }
        }
      }

      // Method 2: Try to get from profile dropdown/menu area
      if (!userInfo.name || !userInfo.profileUrl) {
        console.log('[Job Manager] Trying method 2: profile dropdown...');
        const profileSelectors = [
          '.global-nav__me',
          '[data-control-name="nav.settings_signout"]',
          'button[aria-label*="Profile"]',
          'a[aria-label*="Profile"]',
          '[aria-label*="View profile"]',
          '.global-nav__me-photo'
        ];
        
        let profileElement = null;
        for (const selector of profileSelectors) {
          profileElement = document.querySelector(selector);
          if (profileElement) break;
        }
        
        if (profileElement) {
          // Try to get name from nearby elements
          const container = profileElement.closest('div, li, button, a');
          if (container) {
            // Look for name in various places
            const nameSelectors = [
              'h3', 'h4', 'span[class*="name"]', 
              'div[class*="name"]', 'span', 'div',
              '[aria-label*="profile"]'
            ];
            
            for (const sel of nameSelectors) {
              const nameEl = container.querySelector(sel);
              if (nameEl) {
                const nameText = nameEl.innerText?.trim() || 
                                nameEl.textContent?.trim() ||
                                nameEl.getAttribute('aria-label')?.replace(/View\s+profile\s+of\s*/i, '')?.trim();
                if (nameText && nameText.length > 1 && nameText.length < 100 &&
                    !nameText.toLowerCase().includes('profile') &&
                    !nameText.toLowerCase().includes('sign out') &&
                    !nameText.match(/^\d+$/)) {
                  if (!userInfo.name) {
                    userInfo.name = nameText;
                    console.log('[Job Manager] Found name from dropdown:', userInfo.name);
                  }
                  break;
                }
              }
            }
            
            // Try to get profile URL
            const link = container.querySelector('a[href*="/in/"]') || container.closest('a[href*="/in/"]');
            if (link && link.href && !userInfo.profileUrl) {
              userInfo.profileUrl = link.href.split('?')[0].split('#')[0];
              console.log('[Job Manager] Found profile URL from dropdown:', userInfo.profileUrl);
            }
          }
        }
      }

      // Method 3: Try to get from any visible profile link (fallback)
      if (!userInfo.profileUrl) {
        console.log('[Job Manager] Trying method 3: searching all profile links...');
        const allProfileLinks = document.querySelectorAll('a[href*="/in/"]:not([href*="/jobs"]):not([href*="/company"]):not([href*="/search"])');
        for (const link of allProfileLinks) {
          const href = link.href;
          // Check if it's a user profile (not a company or job)
          if (href.match(/\/in\/[^\/]+\/?$/) && !href.includes('?trk=job') && !href.includes('/in/in/')) {
            userInfo.profileUrl = href.split('?')[0].split('#')[0];
            console.log('[Job Manager] Found profile URL from all links:', userInfo.profileUrl);
            
            // Try to get name from link text
            const nameText = link.innerText?.trim() || 
                           link.textContent?.trim() ||
                           link.getAttribute('aria-label')?.replace(/View\s+profile\s+of\s*/i, '')?.trim();
            if (nameText && nameText.length > 1 && nameText.length < 100 &&
                !nameText.toLowerCase().includes('profile') &&
                !nameText.match(/^\d+$/) &&
                !userInfo.name) {
              userInfo.name = nameText;
              console.log('[Job Manager] Found name from link:', userInfo.name);
            }
            break;
          }
        }
      }

      // Method 4: Try to extract from page metadata or window object
      if (!userInfo.name || !userInfo.profileUrl) {
        console.log('[Job Manager] Trying method 4: window state...');
        try {
          // Try various window object paths
          const possiblePaths = [
            window.__INITIAL_STATE__,
            window.__APP_STATE__,
            window.linkedin,
            window.INITIAL_STATE
          ];
          
          for (const state of possiblePaths) {
            if (state) {
              // Try to find user info in the state
              const userData = state.default?.profileData || 
                             state.profileData || 
                             state.user ||
                             state.default?.user ||
                             state.included?.find(item => item.entityUrn?.includes('profile'));
              
              if (userData) {
                if (userData.firstName && userData.lastName && !userInfo.name) {
                  userInfo.name = `${userData.firstName} ${userData.lastName}`;
                  console.log('[Job Manager] Found name from state:', userInfo.name);
                }
                if (userData.publicIdentifier && !userInfo.profileUrl) {
                  userInfo.profileUrl = `https://www.linkedin.com/in/${userData.publicIdentifier}`;
                  console.log('[Job Manager] Found profile URL from state:', userInfo.profileUrl);
                }
                break;
              }
            }
          }
        } catch (e) {
          console.log('[Job Manager] Could not access window state:', e.message);
        }
      }

      console.log('[Job Manager] Final extracted LinkedIn user info:', userInfo);
    } catch (error) {
      console.error('[Job Manager] Error extracting user info:', error);
    }

    return userInfo;
  }

  // Extract job data from LinkedIn page
  function extractJobData() {
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

    // Check if we're on search results page
    const isSearchResults = window.location.href.includes('/jobs/search');
    const urlParams = new URLSearchParams(window.location.search);
    const currentJobId = urlParams.get('currentJobId');

    console.log('[Job Manager] isSearchResults:', isSearchResults, 'currentJobId:', currentJobId);

    // Try to extract from right panel (search results page)
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
    } else if (data.jobUrl.includes('search-results')) {
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

      // More lenient validation - allow saving even if some fields are missing
      // If we have a jobId, we can save with minimal data
      const urlParams = new URLSearchParams(window.location.search);
      const currentJobId = urlParams.get('currentJobId');
      
      if (!jobData.title && !jobData.company && !currentJobId) {
        const isSearchPage = window.location.href.includes('/jobs/search');
        if (isSearchPage) {
          throw new Error('Please click on a job in the list first to select it, then click "Save to Job Manager". Or navigate to the job detail page.');
        } else {
          throw new Error('Could not extract job details. Please make sure you are on a job detail page.');
        }
      }

      // Set defaults if missing (but we have jobId)
      // Only set default title if we really can't find it
      if (!jobData.title || jobData.title.trim() === '') {
        // Try one more time to get title from page
        const titleEl = document.querySelector('h1.job-details-jobs-unified-top-card__job-title, h1.jobs-details-top-card__job-title, .jobs-details-top-card h1, main h1:first-of-type');
        if (titleEl && titleEl.innerText && titleEl.innerText.trim().length > 3) {
          jobData.title = titleEl.innerText.trim();
        } else if (currentJobId) {
          jobData.title = `Job #${currentJobId}`;
        } else {
          jobData.title = 'Untitled Job';
        }
      }
      if (!jobData.company || jobData.company.trim() === '') {
        jobData.company = 'Unknown Company';
      }
      
      // Extract LinkedIn user information (name and profile URL from page)
      const linkedInUserInfo = extractLinkedInUserInfo();
      
      // Get stored user contact info from Chrome storage (set via popup)
      const storedUserInfo = await chrome.storage.sync.get(['userEmail', 'userPhone', 'userName', 'userProfileUrl']);
      
      // Combine extracted LinkedIn info with stored contact info
      // Priority: Use stored info if available, otherwise use extracted info
      jobData.userInfo = {
        name: (storedUserInfo.userName || linkedInUserInfo.name || '').trim(),
        profileUrl: (storedUserInfo.userProfileUrl || linkedInUserInfo.profileUrl || '').trim(),
        email: (storedUserInfo.userEmail || linkedInUserInfo.email || '').trim(),
        phone: (storedUserInfo.userPhone || linkedInUserInfo.phone || '').trim()
      };

      // Log what we're saving
      console.log('[Job Manager] Saving job data:', JSON.stringify(jobData, null, 2));
      console.log('[Job Manager] User info being sent:', JSON.stringify(jobData.userInfo, null, 2));
      console.log('[Job Manager] Stored user info from popup:', storedUserInfo);

      // Get user ID from storage (default to demo-user)
      const result = await chrome.storage.sync.get(['userId']);
      const userId = result.userId || 'demo-user';
      jobData.userId = userId;

      // Ensure location is not empty string if we couldn't find it
      if (!jobData.location || jobData.location.trim() === '') {
        jobData.location = 'Not specified';
      }

      // Send to API
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData)
      });

      const result_data = await response.json();

      if (!response.ok) {
        throw new Error(result_data.error || 'Failed to save job');
      }

      // Success feedback
      btn.innerHTML = '<span>✓ Saved!</span>';
      btn.style.background = '#10b981';
      
      // Reset after 2 seconds
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L10.5 6L16 7L12 11L12.5 16.5L8 14L3.5 16.5L4 11L0 7L5.5 6L8 1Z" fill="currentColor"/>
          </svg>
          <span>Save to Job Manager</span>
        `;
        btn.style.background = '';
        btn.disabled = false;
      }, 2000);

      // Show notification
      showNotification('Job saved successfully!', 'success');

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
          <span>Save to Job Manager</span>
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

  // Check if we're on a LinkedIn jobs page
  function isLinkedInJobsPage() {
    const url = window.location.href;
    return url.includes('linkedin.com/jobs') || 
           url.includes('linkedin.com/job') ||
           document.querySelector('[data-test-id="job-poster"]') ||
           document.querySelector('.jobs-details') ||
           document.querySelector('.job-details');
  }

  // Initialize
  function init() {
    console.log('[Job Manager] Initializing...', window.location.href);
    
    if (!isLinkedInJobsPage()) {
      console.log('[Job Manager] Not a LinkedIn jobs page, skipping');
      return;
    }

    // Try to create button immediately
    if (document.body) {
      createButton();
    } else {
      // Wait for body
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          createButton();
          bodyObserver.disconnect();
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true });
    }

    // Multiple retry attempts for dynamic content
    const retries = [500, 1000, 2000, 3000];
    retries.forEach(delay => {
      setTimeout(() => {
        if (!document.getElementById(BUTTON_ID)) {
          console.log(`[Job Manager] Retry creating button after ${delay}ms`);
          createButton();
        }
      }, delay);
    });

    // Watch for navigation changes (LinkedIn uses SPA)
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('[Job Manager] URL changed, re-initializing...');
        setTimeout(() => {
          if (!document.getElementById(BUTTON_ID) && isLinkedInJobsPage()) {
            createButton();
          }
        }, 1000);
      }
    });
    urlObserver.observe(document, { subtree: true, childList: true });

    // Expose debug function to window
    window.jobManagerDebug = () => {
      console.log('[Job Manager] Debug Info:');
      console.log('- URL:', window.location.href);
      console.log('- Button exists:', !!document.getElementById(BUTTON_ID));
      console.log('- Is jobs page:', isLinkedInJobsPage());
      console.log('- Body exists:', !!document.body);
      if (!document.getElementById(BUTTON_ID) && isLinkedInJobsPage()) {
        console.log('- Creating button now...');
        createButton();
      }
    };
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run on page load
  window.addEventListener('load', () => {
    setTimeout(init, 500);
  });
})();
