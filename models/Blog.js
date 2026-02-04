const mongoose = require('mongoose');

// Blog Schema
const BlogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  featuredImage: {
    fileName: {
      type: String,
      trim: true
    },
    fileSize: {
      type: Number
    },
    resourceId: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    key: {
      type: String,
      trim: true
    },
    bucket: {
      type: String,
      trim: true
    },
    mimeType: {
      type: String,
      trim: true
    },
    uploadedAt: {
      type: Date
    }
  },
  images: [{
    fileName: {
      type: String,
      trim: true
    },
    fileSize: {
      type: Number
    },
    resourceId: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    key: {
      type: String,
      trim: true
    },
    bucket: {
      type: String,
      trim: true
    },
    mimeType: {
      type: String,
      trim: true
    },
    uploadedAt: {
      type: Date
    }
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate slug from title before saving
BlogSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isNew) {
    // Create slug from title
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Ensure uniqueness by appending timestamp if needed
    // This will be handled in the controller if slug already exists
  }
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
BlogSchema.index({ slug: 1 });
BlogSchema.index({ status: 1, createdAt: -1 });
BlogSchema.index({ author: 1 });
BlogSchema.index({ likes: 1 });
BlogSchema.index({ bookmarks: 1 });

module.exports = mongoose.model('Blog', BlogSchema);

