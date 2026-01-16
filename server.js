const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Job Schema
const JobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String, default: '' },
  jobUrl: { type: String, required: true },
  platform: { type: String, default: 'linkedin' },
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'applied', 'response', 'rejected'],
    default: 'pending'
  },
  userId: { type: String, default: 'demo-user' }, // Will add auth later
  metadata: {
    description: String,
    salary: String,
    requirements: [String]
  },
  createdAt: { type: Date, default: Date.now },
  savedAt: { type: Date, default: Date.now }
});

const Job = mongoose.model('Job', JobSchema);

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Job Application Service API',
    version: '1.0.0'
  });
});

// Create job (from Chrome extension)
app.post('/api/jobs', async (req, res) => {
  try {
    const { title, company, location, jobUrl, platform, metadata } = req.body;

    if (!title || !company || !jobUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: title, company, jobUrl' 
      });
    }

    const job = await Job.create({
      title,
      company,
      location: location || '',
      jobUrl,
      platform: platform || 'linkedin',
      metadata: metadata || {},
      userId: req.body.userId || 'demo-user'
    });

    res.status(201).json({ 
      success: true, 
      job,
      message: 'Job saved successfully'
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save job',
      details: error.message 
    });
  }
});

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const userId = req.query.userId || 'demo-user';
    const jobs = await Job.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ 
      success: true, 
      count: jobs.length,
      jobs 
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch jobs' 
    });
  }
});

// Get single job
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      });
    }

    res.json({ 
      success: true, 
      job 
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch job' 
    });
  }
});

// Update job status
app.patch('/api/jobs/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status is required' 
      });
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      });
    }

    res.json({ 
      success: true, 
      job 
    });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update job' 
    });
  }
});

// Delete job
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Job deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete job' 
    });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const userId = req.query.userId || 'demo-user';
    
    const total = await Job.countDocuments({ userId });
    const pending = await Job.countDocuments({ userId, status: 'pending' });
    const applied = await Job.countDocuments({ userId, status: 'applied' });
    const response = await Job.countDocuments({ userId, status: 'response' });

    res.json({
      success: true,
      stats: {
        total,
        pending,
        applied,
        response,
        rejected: total - pending - applied - response
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch stats' 
    });
  }
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/dashboard.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/jobs`);
  console.log(`📈 Dashboard: http://localhost:${PORT}/dashboard`);
});
