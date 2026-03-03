const mongoose = require('mongoose');

// Job Title Master List Schema - used in signup/onboarding journey
const JobTitleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    unique: true,
    lowercase: true
  },
  displayTitle: {
    type: String,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

JobTitleSchema.index({ isDefault: 1 });

module.exports = mongoose.model('JobTitle', JobTitleSchema);
