const mongoose = require('mongoose');

// Job Schema
const JobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: false, default: '' }, // Not required to allow empty strings for Indeed
  location: { type: String, default: '' },
  jobUrl: { type: String, required: false }, // Optional for custom jobs
  platform: { type: String, default: 'custom' }, // Default to 'custom' instead of 'linkedin'
  status: { 
    type: String, 
    enum: ['pending', 'assigned', 'applied', 'response', 'rejected', 'completed'],
    default: 'pending'
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  assignedAt: { type: Date, default: null },
  metadata: {
    description: String,
    salary: String,
    requirements: [String]
  },
  // User contact info (from extension)
  userInfo: {
    name: { type: String, trim: true },
    profileUrl: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true }
  },
  // Email data
  emailData: {
    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    emailAddress: { type: String, trim: true },
    subject: { type: String, trim: true },
    body: { type: String, trim: true }
  },
  // File attachments
  resume: {
    fileName: { type: String, trim: true },
    fileSize: { type: Number },
    resourceId: { type: String, trim: true },
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    bucket: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date }
  },
  coverLetter: {
    fileName: { type: String, trim: true },
    fileSize: { type: Number },
    resourceId: { type: String, trim: true },
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    bucket: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date }
  },
  screenshotProof: {
    fileName: { type: String, trim: true },
    fileSize: { type: Number },
    resourceId: { type: String, trim: true },
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    bucket: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date }
  },
  // Notes field for employee/user notes
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  notesUpdatedAt: {
    type: Date,
    default: null
  },
  notesUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  savedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', JobSchema);
