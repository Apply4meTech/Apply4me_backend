const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  // Profile picture
  profilePicture: {
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
  // Account manager reference
  accountManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  // Onboarding fields
  isOnboardingComplete: {
    type: Boolean,
    default: false
  },
  // Step 1: Personal Information
  fullName: {
    type: String,
    trim: true
  },
  phoneCode: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  openToRelocate: {
    type: Boolean,
    default: false
  },
  countryOfWork: {
    type: String,
    trim: true
  },
  visaSponsorshipRequired: {
    type: Boolean,
    default: false
  },
  // Step 2: Job Preferences & Compensation
  primaryJobTitles: {
    type: [String],
    default: []
  },
  skills: {
    type: [String],
    default: []
  },
  totalYearsExperience: {
    type: Number
  },
  seniorityLevel: {
    type: String,
    enum: ['Intern', 'Junior', 'Mid level', 'Senior/Lead', ''],
    default: ''
  },
  jobTypes: {
    type: [String],
    default: []
  },
  workLocation: {
    type: String,
    enum: ['Remote', 'Hybrid', 'On-site', ''],
    default: ''
  },
  locationPreference: {
    type: String,
    trim: true
  },
  remoteOnly: {
    type: Boolean,
    default: false
  },
  minAcceptableSalary: {
    type: Number
  },
  preferredSalaryMin: {
    type: Number
  },
  preferredSalaryMax: {
    type: Number
  },
  equityPreference: {
    type: Boolean,
    default: false
  },
  // Step 3: Documents & Links
  resume_details: {
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
  cv_details: {
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
  portfolioWebsite: {
    type: String,
    trim: true
  },
  github: {
    type: String,
    trim: true
  },
  linkedinProfile: {
    type: String,
    trim: true
  },
  personalBlog: {
    type: String,
    trim: true
  },
  // Subscription information
  subscription: {
    planName: {
      type: String,
      enum: ['Starter', 'Standard', 'Pro', 'Premium'],
      default: null
    },
    billingPeriod: {
      type: String,
      enum: ['monthly', 'quarterly', 'onetime'],
      default: null
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: null
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update updatedAt before saving
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
