# Chrome Extension Deployment Guide

## Step 1: Prepare Your Extension for Production

### 1.1 Update API URL
Before deploying, you need to change the API URL from `localhost` to your production server.

**File: `popup.js`**
- Currently: `const API_URL = 'http://localhost:4000';`
- Change to: `const API_URL = 'https://your-production-domain.com';`

**File: `content.js`**
- Currently: `const API_URL = 'http://localhost:4000/api/jobs';`
- Change to: `const API_URL = 'https://your-production-domain.com/api/jobs';`

**File: `manifest.json`**
- Update `host_permissions` to include your production domain
- Remove `http://localhost:4000/*` (or keep it for development)

### 1.2 Create Extension Icons
You need icons in these sizes:
- **16x16** (toolbar icon)
- **48x48** (extension management page)
- **128x128** (Chrome Web Store)

**Option 1: Create Icons Yourself**
- Use any image editor (Photoshop, GIMP, Canva, etc.)
- Create square images with the sizes above
- Save as PNG files
- Name them: `icon16.png`, `icon48.png`, `icon128.png`

**Option 2: Use Online Tools**
- Visit: https://www.favicon-generator.org/ or https://realfavicongenerator.net/
- Upload a logo/image
- Download the generated icons

**Option 3: Use Simple Text/Emoji**
- Create a simple design with your app name or logo
- Export in the required sizes

### 1.3 Update manifest.json with Icons
Add this to your `manifest.json`:
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

## Step 2: Test Your Extension Locally

1. **Load Extension in Chrome:**
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select your `chrome-extension` folder
   - Test all features work correctly

2. **Test with Production API:**
   - Update API URLs to production
   - Reload extension
   - Test saving jobs
   - Verify everything works

## Step 3: Create Production Package

### 3.1 Remove Development Files
Remove or exclude these files from your package:
- `DIAGNOSTIC.md`
- `POPUP_TROUBLESHOOTING.md`
- `TROUBLESHOOTING.md`
- `README.md` (optional - you can keep it)
- `ICONS_NOTE.txt`
- Any `.md` files you don't need

### 3.2 Create ZIP File
1. Select all files in your `chrome-extension` folder EXCEPT:
   - Development documentation files
   - `.git` folder (if present)
   - `node_modules` (if present)
   - Any test files

2. **Required files:**
   - `manifest.json`
   - `content.js`
   - `popup.html`
   - `popup.js`
   - `styles.css`
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

3. **Create ZIP:**
   - Windows: Right-click folder → Send to → Compressed (zipped) folder
   - Mac: Right-click folder → Compress
   - Name it: `job-application-manager-v1.0.0.zip`

## Step 4: Publish to Chrome Web Store

### 4.1 Create Chrome Web Store Developer Account
1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Pay **one-time $5 registration fee** (if not already paid)
4. Accept the Developer Agreement

### 4.2 Upload Your Extension
1. Click **"New Item"** button
2. Upload your ZIP file
3. Fill in the required information:

**Store Listing:**
- **Name:** Job Application Manager (or your preferred name)
- **Short description:** (80 characters max)
  - Example: "Save LinkedIn jobs to your application dashboard instantly"
- **Detailed description:** (132 characters minimum)
  - Describe what your extension does
  - List key features
  - Example:
    ```
    Job Application Manager helps you save LinkedIn job postings directly to your application dashboard.
    
    Features:
    - One-click job saving from LinkedIn
    - Automatic job data extraction
    - Seamless integration with your dashboard
    - User-friendly interface
    
    Simply browse LinkedIn jobs and click "Save to Job Manager" to save any job posting instantly.
    ```

**Privacy:**
- **Single purpose:** Yes
- **Permission justification:** Explain why you need each permission
  - `storage`: To save user ID and preferences
  - `activeTab`: To extract job information from LinkedIn pages
  - `host_permissions`: To access LinkedIn and your API

**Images:**
- **Screenshots:** At least 1, up to 5 (1280x800 or 640x400 recommended)
- **Small promotional tile:** 440x280 (optional but recommended)
- **Marquee promotional tile:** 920x680 (optional)

**Categorization:**
- **Category:** Productivity or Business
- **Language:** English (and others if you support them)

### 4.3 Submit for Review
1. Review all information
2. Click **"Submit for Review"**
3. Wait for review (usually 1-3 business days)
4. You'll receive email notifications about the status

## Step 5: After Approval

1. **Extension goes live** automatically after approval
2. **Share your extension:**
   - Get the Chrome Web Store link
   - Share with users
   - Add to your website

3. **Monitor:**
   - Check reviews and ratings
   - Respond to user feedback
   - Fix bugs and release updates

## Alternative: Manual Distribution (Without Chrome Web Store)

If you don't want to publish to Chrome Web Store, you can distribute manually:

1. **Create ZIP file** (same as Step 3.2)
2. **Share ZIP file** with users
3. **Users install:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select extracted folder

**Note:** Manual distribution has limitations:
- Users must enable Developer mode
- Extension may show warnings
- Not as user-friendly as Chrome Web Store

## Troubleshooting

### Extension Rejected?
- Check email for specific reasons
- Common issues:
  - Missing privacy policy
  - Unclear permission justifications
  - Poor description
  - Missing screenshots

### Need to Update?
1. Update version in `manifest.json`
2. Create new ZIP
3. Upload new version in Chrome Web Store Developer Console
4. Submit for review (updates usually review faster)

## Quick Checklist Before Publishing

- [ ] API URLs updated to production
- [ ] Icons created (16, 48, 128)
- [ ] Icons added to manifest.json
- [ ] Tested extension locally
- [ ] Removed development files
- [ ] Created ZIP package
- [ ] Written store description
- [ ] Prepared screenshots
- [ ] Privacy policy ready (if required)
- [ ] Version number set correctly

## Support

If you need help:
- Chrome Extension Documentation: https://developer.chrome.com/docs/extensions/
- Chrome Web Store Policies: https://developer.chrome.com/docs/webstore/policies/

