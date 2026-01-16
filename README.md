# Job Application Service - POC

Quick start guide to test the job application service today.

## Prerequisites

- Node.js (v16+)
- MongoDB (local or Atlas)
- Chrome browser

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start MongoDB

**Local MongoDB:**
```bash
# Make sure MongoDB is running
mongod
```

**OR use MongoDB Atlas:**
- Create free account at https://www.mongodb.com/cloud/atlas
- Get connection string
- Update `.env` file with `MONGODB_URI`

### 3. Start Backend Server

```bash
npm start
```

Server runs on `http://localhost:4000`

### 4. Install Chrome Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `chrome-extension` folder

### 5. Test It!

1. Visit any LinkedIn job: `https://www.linkedin.com/jobs/view/XXXXX`
2. Click "Save to Job Manager" button (bottom right)
3. Open dashboard: `http://localhost:4000/dashboard.html` (or open `dashboard.html` in browser)

## API Endpoints

- `GET /` - Health check
- `POST /api/jobs` - Save job (from extension)
- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/:id` - Get single job
- `PATCH /api/jobs/:id` - Update job status
- `DELETE /api/jobs/:id` - Delete job
- `GET /api/stats` - Get statistics

## Next Steps

- Add user authentication
- Build worker portal
- Add payment integration
- Deploy to production
