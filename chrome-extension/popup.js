const API_URL = 'http://localhost:4000';

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const testBtn = document.getElementById('testBtn');

  // Check connection on load
  checkConnection();

  testBtn.addEventListener('click', checkConnection);

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
