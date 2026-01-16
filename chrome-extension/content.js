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
          const skipTexts = ['about the job', 'job description', 'show more', 'show less', 'apply now', 'save', 'easy apply'];
          
          // First, try to find title in the top card area (usually before company)
          const topCard = rightPanel.querySelector('.jobs-details-top-card') ||
                         rightPanel.querySelector('.job-details-top-card') ||
                         rightPanel.querySelector('[class*="top-card"]') ||
                         rightPanel;
          
          // Look for h1 or h2 in top card first
          const topCardTitle = topCard.querySelector('h1') || topCard.querySelector('h2');
          if (topCardTitle) {
            const text = topCardTitle.innerText.trim();
            const lowerText = text.toLowerCase();
            if (text.length > 3 && 
                !skipTexts.some(skip => lowerText.includes(skip)) &&
                !lowerText.startsWith('about') &&
                !lowerText.startsWith('show')) {
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
                  !lowerText.includes('qualification')) {
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
                               rightPanel.querySelector('.jobs-details-top-card__primary-description');
          
          // If not found, search for elements containing bullet separator or location text
          if (!locationInPanel) {
            const allElements = rightPanel.querySelectorAll('span, div, p, li');
            for (const el of allElements) {
              const text = el.innerText.trim();
              // Look for location patterns: contains ·, or location keywords, or country names
              if ((text.includes('·') || text.match(/\b(India|Remote|Hybrid|On-site|Gurugram|Bangalore|Delhi|Noida|Hyderabad)\b/i)) && 
                  text.length < 200 && 
                  text.length > 3) {
                locationInPanel = el;
                break;
              }
            }
          }
          
          if (locationInPanel && locationInPanel.innerText.trim()) {
            const text = locationInPanel.innerText.trim();
            const parts = text.split('·');
            let location = parts[parts.length - 1]?.trim() || text;
            // Clean up common prefixes (dates, applicant counts, etc.)
            location = location.replace(/^[0-9]+\s*(day|days|month|months|ago|applicants?)\s*·?\s*/i, '').trim();
            location = location.replace(/^Over\s+\d+\s+applicants?\s*·?\s*/i, '').trim();
            data.location = location;
            console.log('[Job Manager] Found location in right panel:', data.location);
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
                            jobCard.querySelector('.base-search-card__metadata');
        if (cardLocation) {
          data.location = cardLocation.innerText.trim();
          console.log('[Job Manager] Found location from card:', data.location);
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
        // Search results right panel
        '.jobs-search__job-details h1',
        '.jobs-details-top-card__job-title h1',
        '.jobs-details-top-card h1',
        '.job-details-top-card h1',
        '.scaffold-layout__detail h1',
        // Standard detail page
        'h1.job-details-jobs-unified-top-card__job-title',
        'h1.jobs-details-top-card__job-title',
        'h1[data-test-id="job-title"]',
        '.job-details-jobs-unified-top-card__job-title',
        'h1.job-details__job-title',
        '.jobs-details__job-title h1',
        'h1.jobs-details-top-card__job-title-link',
        // Generic fallback
        'main h1',
        'h1'
      ];
      
      const skipTexts = ['about the job', 'job description', 'show more', 'show less', 'apply now', 'save', 'linkedin'];
      
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.trim()) {
          const text = element.innerText.trim();
          const lowerText = text.toLowerCase();
          
          // Skip generic headings and section titles
          if (text.length > 3 && 
              !skipTexts.some(skip => lowerText.includes(skip)) &&
              !lowerText.startsWith('about') &&
              !lowerText.startsWith('show')) {
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
        // Search results right panel
        '.jobs-details-top-card__primary-description',
        '.jobs-details-top-card__primary-description-without-tagline',
        '.scaffold-layout__detail .jobs-details-top-card__primary-description',
        // Standard detail page
        '.job-details-jobs-unified-top-card__primary-description-without-tagline',
        '.job-details-jobs-unified-top-card__bullet',
        '[data-test-id="job-location"]',
        '.job-details__job-criteria-text',
        '.jobs-unified-top-card__primary-description',
        '.jobs-details__primary-description'
      ];
      
      for (const selector of locationSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.trim()) {
          const text = element.innerText.trim();
          // Extract location (usually after company name, separated by ·)
          const parts = text.split('·');
          // Take the last part (usually location) or the whole text
          let location = parts[parts.length - 1]?.trim() || text;
          // Clean up common prefixes
          location = location.replace(/^[0-9]+\s*(day|days|month|months|ago)\s*·?\s*/i, '').trim();
          data.location = location;
          console.log('[Job Manager] Found location:', data.location, 'using selector:', selector);
          break;
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
      if (!jobData.title) {
        if (currentJobId) {
          jobData.title = `Job #${currentJobId}`;
        } else {
          jobData.title = 'Untitled Job';
        }
      }
      if (!jobData.company) {
        jobData.company = 'Unknown Company';
      }
      
      // Log what we're saving
      console.log('[Job Manager] Saving job data:', jobData);

      // Get user ID from storage (default to demo-user)
      const result = await chrome.storage.sync.get(['userId']);
      const userId = result.userId || 'demo-user';
      jobData.userId = userId;

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
