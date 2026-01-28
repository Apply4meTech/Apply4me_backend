const API_URL = 'http://localhost:4000';

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const testBtn = document.getElementById('testBtn');
  const userNameEl = document.getElementById('userName');
  const userProfileUrlEl = document.getElementById('userProfileUrl');
  const userEmailEl = document.getElementById('userEmail');
  const userPhoneEl = document.getElementById('userPhone');
  const saveInfoBtn = document.getElementById('saveInfoBtn');
  const infoMsgEl = document.getElementById('infoMsg');

  // Load saved user info
  loadUserInfo();

  // Check connection on load
  checkConnection();

  testBtn.addEventListener('click', checkConnection);
  saveInfoBtn.addEventListener('click', saveUserInfo);

  async function loadUserInfo() {
    try {
      const result = await chrome.storage.sync.get(['userName', 'userProfileUrl', 'userEmail', 'userPhone']);
      if (result.userName) {
        userNameEl.value = result.userName;
      }
      if (result.userProfileUrl) {
        userProfileUrlEl.value = result.userProfileUrl;
      }
      if (result.userEmail) {
        userEmailEl.value = result.userEmail;
      }
      if (result.userPhone) {
        userPhoneEl.value = result.userPhone;
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  }

  async function saveUserInfo() {
    const name = userNameEl.value.trim();
    const profileUrl = userProfileUrlEl.value.trim();
    const email = userEmailEl.value.trim();
    const phone = userPhoneEl.value.trim();

    try {
      await chrome.storage.sync.set({
        userName: name || '',
        userProfileUrl: profileUrl || '',
        userEmail: email || '',
        userPhone: phone || ''
      });

      infoMsgEl.textContent = '✓ Contact info saved!';
      infoMsgEl.style.display = 'block';
      infoMsgEl.style.color = '#10b981';
      
      setTimeout(() => {
        infoMsgEl.style.display = 'none';
      }, 2000);
    } catch (error) {
      infoMsgEl.textContent = '✗ Failed to save';
      infoMsgEl.style.display = 'block';
      infoMsgEl.style.color = '#ef4444';
      console.error('Error saving user info:', error);
    }
  }

  async function checkConnection() {
    statusEl.textContent = 'Checking...';
    statusEl.className = 'status';

    try {
      const response = await fetch(`${API_URL}/`);
      const data = await response.json();

      if (response.ok) {
        statusEl.textContent = '✓ Connected to API';
        statusEl.className = 'status connected';
      } else {
        throw new Error('API not responding');
      }
    } catch (error) {
      statusEl.textContent = '✗ Cannot connect to API';
      statusEl.className = 'status';
      console.error('Connection error:', error);
    }
  }
});
