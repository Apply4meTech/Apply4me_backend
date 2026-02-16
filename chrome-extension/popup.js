// Popup script - handles authentication status and UI
document.addEventListener('DOMContentLoaded', async () => {
  const loadingState = document.getElementById('loadingState');
  const authenticatedState = document.getElementById('authenticatedState');
  const unauthenticatedState = document.getElementById('unauthenticatedState');
  const errorState = document.getElementById('errorState');
  const loginBtn = document.getElementById('loginBtn');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const errorMsg = document.getElementById('errorMsg');

  const DASHBOARD_URL = 'http://localhost:3000/login';

  // Show loading state
  function showLoading() {
    loadingState.classList.remove('hidden');
    authenticatedState.classList.add('hidden');
    unauthenticatedState.classList.add('hidden');
    errorState.classList.add('hidden');
  }

  // Show authenticated state
  function showAuthenticated(user) {
    loadingState.classList.add('hidden');
    authenticatedState.classList.remove('hidden');
    unauthenticatedState.classList.add('hidden');
    errorState.classList.add('hidden');
    
    if (user) {
      userName.textContent = user.name || 'User';
      userEmail.textContent = user.email || '';
    }
  }

  // Show unauthenticated state
  function showUnauthenticated() {
    loadingState.classList.add('hidden');
    authenticatedState.classList.add('hidden');
    unauthenticatedState.classList.remove('hidden');
    errorState.classList.add('hidden');
  }

  // Show error state
  function showError(message) {
    loadingState.classList.add('hidden');
    authenticatedState.classList.add('hidden');
    unauthenticatedState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMsg.textContent = message || 'An error occurred';
  }

  // Check authentication status
  async function checkAuth() {
    try {
      showLoading();
      
      // Request auth check from background script
      const response = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      
      if (response && response.success) {
        if (response.auth && response.auth.token && response.auth.user) {
          // User is authenticated
          showAuthenticated(response.auth.user);
        } else {
          // User is not authenticated
          showUnauthenticated();
        }
      } else {
        // Try to get cached auth
        const cached = await chrome.storage.local.get(['token', 'user']);
        if (cached.token && cached.user) {
          showAuthenticated(cached.user);
        } else {
          showUnauthenticated();
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      // Fallback: check storage directly
      try {
        const cached = await chrome.storage.local.get(['token', 'user']);
        if (cached.token && cached.user) {
          showAuthenticated(cached.user);
        } else {
          showUnauthenticated();
        }
      } catch (storageError) {
        showError('Failed to check authentication status');
      }
    }
  }

  // Handle login button click
  loginBtn.addEventListener('click', async () => {
    try {
      // Open dashboard login page in new tab
      await chrome.tabs.create({ url: DASHBOARD_URL });
      // Close popup
      window.close();
    } catch (error) {
      console.error('Error opening login page:', error);
      showError('Failed to open login page');
    }
  });

  // Check auth on load
  await checkAuth();

  // Periodically check auth status (every 2 seconds)
  setInterval(checkAuth, 2000);
  
  // Listen for storage changes (when logout is detected)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      // Check if token or user was removed (logout detected)
      if (changes.token && changes.token.newValue === undefined) {
        console.log('[Job Manager Popup] Token removed - logout detected');
        showUnauthenticated();
      } else if (changes.user && changes.user.newValue === undefined) {
        console.log('[Job Manager Popup] User removed - logout detected');
        showUnauthenticated();
      } else if (changes.token && changes.token.newValue && changes.user && changes.user.newValue) {
        // Auth was added/updated
        console.log('[Job Manager Popup] Auth updated');
        checkAuth();
      }
    }
  });
});
