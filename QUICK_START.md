# 🚀 QUICK START - Test in 5 Minutes

## Step 1: Install Dependencies (1 min)
```bash
npm install
```

## Step 2: Start MongoDB
**Option A - Local:**
```bash
# Make sure MongoDB is installed and running
mongod
```

**Option B - MongoDB Atlas (Cloud - Free):**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Create `.env` file:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/job_poc
```

## Step 3: Start Backend (30 sec)
```bash
npm start
```
✅ Server running on http://localhost:4000

## Step 4: Load Chrome Extension (1 min)
1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. ✅ Extension installed!

## Step 5: TEST IT! (2 min)
1. Go to LinkedIn: https://www.linkedin.com/jobs/
2. Click any job to open detail page
3. See "Save to Job Manager" button (bottom right)
4. Click it!
5. Open dashboard: http://localhost:4000/dashboard
6. 🎉 See your saved job!

## Troubleshooting

**Extension button not showing?**
- Make sure you're on a job detail page (URL: linkedin.com/jobs/view/...)
- Refresh the page
- Check browser console for errors

**API connection error?**
- Make sure backend is running (`npm start`)
- Check http://localhost:4000/ returns JSON

**MongoDB error?**
- Make sure MongoDB is running
- Check connection string in `.env`

## Next Steps
- Add authentication
- Build worker portal
- Deploy to production
