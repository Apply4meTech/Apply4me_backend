# Extension Popup Not Opening - Troubleshooting

## Quick Fixes

### 1. Reload the Extension
1. Go to `chrome://extensions/`
2. Find "Job Application Manager"
3. Click the **reload icon** (🔄)
4. Try clicking the extension icon again

### 2. Pin the Extension Icon
1. Go to `chrome://extensions/`
2. Find "Job Application Manager"
3. Click the **pin icon** (📌) to pin it to the toolbar
4. The extension icon should now be visible in your toolbar

### 3. Check Extension Icon
- Look for the extension icon in Chrome toolbar (top right)
- If you don't see it, click the **puzzle piece icon** (🧩) to see all extensions
- Find "Job Application Manager" and click it

### 4. Check for Errors
1. Right-click the extension icon
2. Select "Inspect popup" (if available)
3. Or go to `chrome://extensions/` → "Job Application Manager" → "Inspect views: popup"
4. Check the console for any errors

### 5. Verify Files Exist
Make sure these files are in the `chrome-extension` folder:
- ✅ `manifest.json`
- ✅ `popup.html`
- ✅ `popup.js`

### 6. Check Manifest
The manifest should have:
```json
"action": {
  "default_popup": "popup.html"
}
```

### 7. Try Right-Click
- Right-click the extension icon
- Select "Inspect popup" to see if there are errors

## Common Issues

**Extension icon not visible:**
- Pin the extension in `chrome://extensions/`
- Check if extension is enabled (toggle should be ON)

**Popup opens but is blank:**
- Check browser console for errors
- Verify `popup.html` and `popup.js` are in the same folder as `manifest.json`

**Popup doesn't open at all:**
- Reload the extension
- Check if extension is enabled
- Try disabling and re-enabling the extension

## Manual Test

1. Open `chrome://extensions/`
2. Find "Job Application Manager"
3. Click "Inspect views: popup" (if available)
4. This will open the popup in a separate window for debugging

