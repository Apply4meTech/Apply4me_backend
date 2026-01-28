const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('../models/Job');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';

async function linkJobToUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const userEmail = 'ayushsingla21.dev@gmail.com';
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('❌ User not found:', userEmail);
      process.exit(1);
    }
    
    console.log('✅ Found user:', user.name, user._id);

    // Find job by userInfo email
    const job = await Job.findOne({ 
      'userInfo.email': userEmail,
      userId: null 
    });
    
    if (!job) {
      console.log('❌ Job not found with userInfo.email:', userEmail);
      process.exit(1);
    }
    
    console.log('✅ Found job:', job.title, job._id);

    // Link job to user
    job.userId = user._id;
    await job.save();
    
    console.log('✅ Job linked to user successfully');
    console.log('Job ID:', job._id);
    console.log('User ID:', user._id);
    console.log('Job Title:', job.title);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

linkJobToUser();

