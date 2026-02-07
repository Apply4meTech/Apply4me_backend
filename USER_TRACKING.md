# User Information Tracking Guide

## How User Information is Tracked

When users save jobs through the Chrome extension, their contact information (email/phone) is automatically saved with each job if they've provided it in the extension popup.

## Setup User Information

1. **User opens extension popup** (click extension icon)
2. **Enters email and/or phone** in the form
3. **Clicks "Save Contact Info"**
4. **Information is stored** in Chrome's sync storage
5. **Automatically included** with every job they save

## View User Information

### 1. Check Individual Jobs

Each job document in MongoDB has a `userInfo` field:

```json
{
  "userInfo": {
    "email": "user@example.com",
    "phone": "+1234567890"
  }
}
```

### 2. API Endpoints

#### Get All Unique Users
```bash
GET http://localhost:4000/api/jobs/users
```

Returns all unique users who have saved jobs:
```json
{
  "success": true,
  "count": 5,
  "users": [
    {
      "email": "user@example.com",
      "phone": "+1234567890",
      "firstSeen": "2026-01-27T17:00:00.000Z",
      "jobCount": 3
    }
  ]
}
```

#### Get Jobs by User Email
```bash
GET http://localhost:4000/api/jobs/by-user?email=user@example.com
```

#### Get Jobs by User Phone
```bash
GET http://localhost:4000/api/jobs/by-user?phone=+1234567890
```

#### Get Jobs by Both Email and Phone
```bash
GET http://localhost:4000/api/jobs/by-user?email=user@example.com&phone=+1234567890
```

### 3. MongoDB Queries

#### Find all jobs with user info:
```javascript
db.jobs.find({ "userInfo.email": { $exists: true, $ne: "" } })
```

#### Find jobs by specific email:
```javascript
db.jobs.find({ "userInfo.email": "user@example.com" })
```

#### Find jobs by specific phone:
```javascript
db.jobs.find({ "userInfo.phone": "+1234567890" })
```

#### Get unique users:
```javascript
db.jobs.distinct("userInfo.email", { "userInfo.email": { $exists: true, $ne: "" } })
```

## Logging

### Extension Console
When a job is saved, check browser console for:
```
[Job Manager] 📧 Including user info: { email: "...", phone: "..." }
```

### Backend Console
Check server logs for:
```
📧 User info received: { email: "...", phone: "...", jobTitle: "...", company: "..." }
```

## Troubleshooting

### User info not appearing in saved jobs?

1. **Check if user saved info in extension:**
   - Open extension popup
   - Verify email/phone are filled
   - Click "Save Contact Info"

2. **Check extension console:**
   - Open browser DevTools (F12)
   - Look for `[Job Manager] 📧 Including user info` message
   - If you see `⚠️ No user info found`, user hasn't saved their info

3. **Check backend logs:**
   - Look for `📧 User info received` message
   - If not appearing, userInfo might not be sent from extension

4. **Check database:**
   - Query: `db.jobs.findOne({ "userInfo.email": { $exists: true } })`
   - If no results, userInfo isn't being saved

## Example Usage

### Track which users saved which jobs:
```javascript
// Get all jobs with user info
const jobsWithUsers = await Job.find({
  $or: [
    { 'userInfo.email': { $exists: true, $ne: '' } },
    { 'userInfo.phone': { $exists: true, $ne: '' } }
  ]
});

// Group by user
const usersMap = new Map();
jobsWithUsers.forEach(job => {
  const key = job.userInfo.email || job.userInfo.phone;
  if (!usersMap.has(key)) {
    usersMap.set(key, []);
  }
  usersMap.get(key).push(job);
});
```

### Get user statistics:
```javascript
// Count jobs per user
const userStats = await Job.aggregate([
  {
    $match: {
      'userInfo.email': { $exists: true, $ne: '' }
    }
  },
  {
    $group: {
      _id: '$userInfo.email',
      jobCount: { $sum: 1 },
      companies: { $addToSet: '$company' }
    }
  }
]);
```

