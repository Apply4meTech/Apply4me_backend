const mongoose = require('mongoose');

// Newsletter Subscription Schema
const NewsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Index for faster email lookups
NewsletterSchema.index({ email: 1 });

module.exports = mongoose.model('Newsletter', NewsletterSchema);

