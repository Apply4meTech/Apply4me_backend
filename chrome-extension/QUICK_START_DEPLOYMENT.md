# Quick Start: Deploy Your Chrome Extension

## 🚀 Fast Track (5 Steps)

### Step 1: Update API URLs
Replace `localhost` with your production domain:

**File: `popup.js`** (line 1)
```javascript
// Change this:
const API_URL = 'http://localhost:4000';
// To this:
const API_URL = 'https://your-production-domain.com';
```

**File: `content.js` (line 5)**
```javascript
// Change this:
const API_URL = 'http://localhost:4000/api/jobs';
// To this:
const API_URL = 'https://your-production-domain.com/api/jobs';
```

**File: `manifest.json` (line 12)**
```json
// Change this:
"http://localhost:4000/*"
// To this:
"https://your-production-domain.com/*"
```

### Step 2: Create Icons
You need 3 icon files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)  
- `icon128.png` (128x128 pixels)

**Easy way:** Use Canva.com or any design tool, create a simple logo, export in 3 sizes.

### Step 3: Update manifest.json
Add icon section to `manifest.json`:
```json
{
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  }
}
```

### Step 4: Create ZIP Package
1. Select these files:
   - ✅ manifest.json
   - ✅ content.js
   - ✅ popup.html
   - ✅ popup.js
   - ✅ styles.css
   - ✅ icon16.png
   - ✅ icon48.png
   - ✅ icon128.png

2. **DO NOT include:**
   - ❌ Any .md files
   - ❌ .git folder
   - ❌ node_modules

3. Right-click → Compress to ZIP
4. Name it: `job-manager-v1.0.0.zip`

### Step 5: Publish to Chrome Web Store

1. **Go to:** https://chrome.google.com/webstore/devconsole
2. **Sign in** with Google account
3. **Pay $5** one-time fee (if first time)
4. **Click "New Item"**
5. **Upload your ZIP file**
6. **Fill in the form:**
   - Name: Job Application Manager
   - Description: (see DEPLOYMENT_GUIDE.md for example)
   - Screenshots: At least 1 (1280x800 recommended)
   - Category: Productivity
7. **Click "Submit for Review"**
8. **Wait 1-3 days** for approval

## 📝 Need More Details?

- **Full guide:** See `DEPLOYMENT_GUIDE.md`
- **Checklist:** See `PRE_DEPLOYMENT_CHECKLIST.md`
- **Production manifest example:** See `manifest.production.json`

## ⚠️ Important Notes

1. **Test locally first** with production API URL before publishing
2. **Icons are required** for Chrome Web Store
3. **Screenshots are required** (at least 1)
4. **Review takes 1-3 business days**
5. **You can update** after publishing (just increment version number)

## 🆘 Need Help?

- Chrome Extension Docs: https://developer.chrome.com/docs/extensions/
- Chrome Web Store Help: https://support.google.com/chrome_webstore/

