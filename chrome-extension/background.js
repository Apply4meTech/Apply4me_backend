// Background script to check authentication from ApplyForMe dashboard
// This script runs in the background and checks for authentication status

const DASHBOARD_DOMAINS = [
  'https://www.applyforme.com.au',  // Production (www subdomain - primary)
  'https://applyforme.com.au',     // Production (root domain)
  'http://localhost:3000',
  'https://localhost:3000',
];

const CHECK_INTERVAL = 2000; // Check every 2 seconds
let checkIntervalId = null;

// Function to get auth data from dashboard tabs
async function getAuthFromDashboard() {
  try {
    let foundDashboardTab = false;
    let hasAuthInDashboard = false;
    
    // Find all tabs that match dashboard domains
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (!tab.url) continue;
      
      // Check if tab is from dashboard domain
      const isDashboardTab = DASHBOARD_DOMAINS.some(domain => 
        tab.url.startsWith(domain)
      );
      
      if (isDashboardTab) {
        foundDashboardTab = true;
        try {
          // Inject script to read localStorage from dashboard tab
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              try {
                const token = localStorage.getItem('token');
                const user = localStorage.getItem('user');
                return { token, user };
              } catch (error) {
                return { token: null, user: null, error: error.message };
              }
            }
          });
          
          if (results && results[0] && results[0].result) {
            const { token, user } = results[0].result;
            
            // Check if user has logged out (token/user are null or empty)
            if (!token || !user || token === 'null' || user === 'null') {
              // User has logged out - clear extension storage immediately
              console.log('[ApplyForMe] Logout detected in dashboard, clearing extension auth');
              chrome.storage.local.remove(['token', 'user', 'lastAuthCheck']).then(() => {
                console.log('[ApplyForMe] Extension auth cleared after logout');
              });
              return null;
            }
            
            if (token && user) {
              hasAuthInDashboard = true;
              // Store auth data in extension storage
              await chrome.storage.local.set({
                token,
                user: JSON.parse(user),
                lastAuthCheck: Date.now()
              });
              
              console.log('[ApplyForMe] Auth data synced from dashboard');
              return { token, user: JSON.parse(user) };
            }
          }
        } catch (error) {
          // Tab might not be accessible (chrome:// pages, etc.)
          console.log('[Job Manager] Could not access tab:', error.message);
        }
      }
    }
    
    // If we found dashboard tabs but no auth, user has logged out
    if (foundDashboardTab && !hasAuthInDashboard) {
      console.log('[ApplyForMe] Dashboard tab found but no auth - user logged out');
      await chrome.storage.local.remove(['token', 'user', 'lastAuthCheck']);
      return null;
    }
    
    // If no dashboard tabs found, check cached auth (user might have closed dashboard tab)
    if (!foundDashboardTab) {
      const cached = await chrome.storage.local.get(['token', 'user', 'lastAuthCheck']);
      if (cached.token && cached.user && cached.lastAuthCheck) {
        // If cache is less than 5 minutes old, use it
        if (Date.now() - cached.lastAuthCheck < 5 * 60 * 1000) {
          return { token: cached.token, user: cached.user };
        } else {
          // Cache expired, clear it
          await chrome.storage.local.remove(['token', 'user', 'lastAuthCheck']);
        }
      }
    }
    
    // No auth found, clear storage
    await chrome.storage.local.remove(['token', 'user', 'lastAuthCheck']);
    return null;
  } catch (error) {
    console.error('[ApplyForMe] Error checking auth:', error);
    return null;
  }
}

// Function to verify token with backend
async function verifyToken(token) {
  try {
    const API_URL = 'https://api.applyforme.com.au/api/auth/verify';
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.success && data.user;
    }
    return false;
  } catch (error) {
    console.error('[ApplyForMe] Token verification error:', error);
    return false;
  }
}

// Periodically check for authentication
async function startAuthCheck() {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
  }
  
  checkIntervalId = setInterval(async () => {
    const auth = await getAuthFromDashboard();
    
    if (auth && auth.token) {
      // Verify token is still valid
      const isValid = await verifyToken(auth.token);
      if (!isValid) {
        // Token invalid, clear storage
        console.log('[ApplyForMe] Token invalid, clearing extension auth');
        await chrome.storage.local.remove(['token', 'user', 'lastAuthCheck']);
      }
    } else {
      // No auth found - make sure storage is cleared
      const cached = await chrome.storage.local.get(['token', 'user']);
      if (cached.token || cached.user) {
        console.log('[ApplyForMe] No auth in dashboard but extension has cached data - clearing');
        await chrome.storage.local.remove(['token', 'user', 'lastAuthCheck']);
      }
    }
  }, CHECK_INTERVAL);
  
  // Also check immediately
  await getAuthFromDashboard();
}

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuth') {
    getAuthFromDashboard().then(auth => {
      sendResponse({ success: true, auth });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'getAuth') {
    chrome.storage.local.get(['token', 'user']).then(data => {
      sendResponse({ success: true, auth: data.token && data.user ? data : null });
    });
    return true;
  }
});

// Start checking when extension loads
chrome.runtime.onStartup.addListener(() => {
  startAuthCheck();
});

chrome.runtime.onInstalled.addListener(() => {
  startAuthCheck();
});

// Start checking immediately
startAuthCheck();

