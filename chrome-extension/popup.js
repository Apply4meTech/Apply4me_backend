document.addEventListener('DOMContentLoaded', async () => {
  const userIdEl = document.getElementById('userId');
  const saveInfoBtn = document.getElementById('saveInfoBtn');
  const infoMsgEl = document.getElementById('infoMsg');

  // Load saved user ID
  loadUserId();

  saveInfoBtn.addEventListener('click', saveUserId);

  async function loadUserId() {
    try {
      const result = await chrome.storage.sync.get(['userId']);
      if (result.userId) {
        userIdEl.value = result.userId;
      }
    } catch (error) {
      console.error('Error loading user ID:', error);
    }
  }

  async function saveUserId() {
    const userId = userIdEl.value.trim();

    if (!userId) {
      infoMsgEl.textContent = '✗ Please enter a user ID';
      infoMsgEl.style.display = 'block';
      infoMsgEl.style.color = '#ef4444';
      setTimeout(() => {
        infoMsgEl.style.display = 'none';
      }, 2000);
      return;
    }

    try {
      await chrome.storage.sync.set({
        userId: userId
      });

      infoMsgEl.textContent = '✓ User ID saved!';
      infoMsgEl.style.display = 'block';
      infoMsgEl.style.color = '#10b981';
      
      setTimeout(() => {
        infoMsgEl.style.display = 'none';
      }, 2000);
    } catch (error) {
      infoMsgEl.textContent = '✗ Failed to save';
      infoMsgEl.style.display = 'block';
      infoMsgEl.style.color = '#ef4444';
      console.error('Error saving user ID:', error);
    }
  }
});
