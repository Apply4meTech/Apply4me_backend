# Pre-Deployment Checklist

Use this checklist before creating your production package.

## ✅ Configuration Updates

- [ ] **Update API URL in `popup.js`**
  - Change: `const API_URL = 'http://localhost:4000';`
  - To: `const API_URL = 'https://your-production-domain.com';`

- [ ] **Update API URL in `content.js`**
  - Change: `const API_URL = 'http://localhost:4000/api/jobs';`
  - To: `const API_URL = 'https://your-production-domain.com/api/jobs';`

- [ ] **Update `manifest.json`**
  - Replace `http://localhost:4000/*` with your production domain
  - Add icon references (see below)

## ✅ Icons Required

Create these icon files (PNG format):
- [ ] `icon16.png` (16x16 pixels)
- [ ] `icon48.png` (48x48 pixels)
- [ ] `icon128.png` (128x128 pixels)

**Quick Icon Creation:**
1. Use Canva, Figma, or any design tool
2. Create a simple logo with your app name or symbol
3. Export in all three sizes
4. Place files in `chrome-extension` folder

## ✅ Testing

- [ ] Test extension with production API URL
- [ ] Verify job saving works
- [ ] Test on different LinkedIn job pages
- [ ] Verify popup works correctly
- [ ] Check for console errors

## ✅ Files to Include in ZIP

**Required Files:**
- [ ] `manifest.json`
- [ ] `content.js`
- [ ] `popup.html`
- [ ] `popup.js`
- [ ] `styles.css`
- [ ] `icon16.png`
- [ ] `icon48.png`
- [ ] `icon128.png`

**Files to EXCLUDE:**
- [ ] `DIAGNOSTIC.md`
- [ ] `POPUP_TROUBLESHOOTING.md`
- [ ] `TROUBLESHOOTING.md`
- [ ] `ICONS_NOTE.txt`
- [ ] `README.md` (optional)
- [ ] `DEPLOYMENT_GUIDE.md` (optional)
- [ ] `PRE_DEPLOYMENT_CHECKLIST.md` (optional)
- [ ] Any `.git` folders
- [ ] Any `node_modules` folders

## ✅ Version Number

- [ ] Update version in `manifest.json` if needed
- [ ] Format: `"version": "1.0.0"` (major.minor.patch)

## ✅ Chrome Web Store Requirements

- [ ] Store listing description written (min 132 characters)
- [ ] Short description written (max 80 characters)
- [ ] At least 1 screenshot prepared (1280x800 or 640x400)
- [ ] Privacy policy URL (if required)
- [ ] Permission justifications ready

## Quick Commands

**To find and replace API URLs (Windows PowerShell):**
```powershell
# In popup.js
(Get-Content popup.js) -replace 'http://localhost:4000', 'https://your-domain.com' | Set-Content popup.js

# In content.js
(Get-Content content.js) -replace 'http://localhost:4000', 'https://your-domain.com' | Set-Content content.js
```

**To find and replace API URLs (Mac/Linux):**
```bash
# In popup.js
sed -i 's|http://localhost:4000|https://your-domain.com|g' popup.js

# In content.js
sed -i 's|http://localhost:4000|https://your-domain.com|g' content.js
```

## After Completing Checklist

1. Create ZIP file with only required files
2. Test ZIP by loading it as unpacked extension
3. Follow DEPLOYMENT_GUIDE.md for publishing steps

