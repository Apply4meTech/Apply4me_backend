# Troubleshooting: Button Not Visible

## Quick Fixes

### 1. Reload Extension
1. Go to `chrome://extensions`
2. Find "Job Application Manager"
3. Click the reload icon (🔄)
4. Refresh the LinkedIn page

### 2. Check Console for Errors
1. Open LinkedIn job page
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Look for `[Job Manager]` messages
5. Type `jobManagerDebug()` and press Enter

### 3. Verify Extension is Active
1. Click extension icon in Chrome toolbar
2. Should show "✓ Connected to API" (if backend is running)
3. If not, check backend is running: `npm start`

### 4. Check URL Pattern
Button only appears on:
- `https://www.linkedin.com/jobs/view/*`
- `https://www.linkedin.com/jobs/search/*`
- Any page with `linkedin.com/jobs` in URL

### 5. Manual Button Creation
Open browser console (F12) and type:
```javascript
jobManagerDebug()
```

This will:
- Show debug info
- Try to create button if missing
- Show current page status

## Common Issues

**Button appears then disappears:**
- LinkedIn's dynamic content might be removing it
- Check console for errors
- Try `jobManagerDebug()` to recreate

**Button never appears:**
- Make sure you're on a LinkedIn jobs page
- Check extension is enabled in `chrome://extensions`
- Reload extension and page

**Button appears but doesn't work:**
- Check backend is running (`npm start`)
- Check API URL in console (should be `http://localhost:4000`)
- Check CORS errors in console

## Still Not Working?

1. Check extension permissions in `chrome://extensions`
2. Verify `manifest.json` has correct URL patterns
3. Check browser console for any errors
4. Try incognito mode (with extension enabled)
