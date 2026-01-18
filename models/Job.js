const mongoose = require('mongoose');

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

module.exports = mongoose.model('Job', JobSchema);
