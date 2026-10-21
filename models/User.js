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
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin'],
    default: 'user',
    index: true
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
  // Affiliate referral - set when user signs up via affiliate link
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    default: null
  },
  // Onboarding fields
  isOnboardingComplete: {
    type: Boolean,
    default: false
  },
  onboardingCompletedAt: {
    type: Date,
    default: null
  },
  // Step 1: Personal Information
  fullName: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
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
  // Separate address fields for structured address
  houseNumber: {
    type: String,
    trim: true
  },
  streetName: {
    type: String,
    trim: true
  },
  suburb: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  postcode: {
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
  currentLocation: {
    type: String,
    trim: true
  },
  workRightsInAustralia: {
    type: String,
    enum: ['Citizen', 'Permanent Resident', 'Visa Holder', ''],
    default: ''
  },
  visaType: {
    type: String,
    trim: true
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
  academicTranscripts_details: {
    fileName: { type: String, trim: true },
    fileSize: { type: Number },
    resourceId: { type: String, trim: true },
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    bucket: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date }
  },
  certifications_details: {
    fileName: { type: String, trim: true },
    fileSize: { type: Number },
    resourceId: { type: String, trim: true },
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    bucket: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date }
  },
  visaAttachment_details: {
    fileName: { type: String, trim: true },
    fileSize: { type: Number },
    resourceId: { type: String, trim: true },
    url: { type: String, trim: true },
    key: { type: String, trim: true },
    bucket: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    uploadedAt: { type: Date }
  },
  // Employment History
  currentRole: { type: String, trim: true },
  previousRoles: { type: String, trim: true },
  keyResponsibilities: { type: String, trim: true },
  keyAchievements: { type: String, trim: true },
  employmentHistory: [
    {
      jobTitle: { type: String, trim: true },
      company: { type: String, trim: true },
      startDate: { type: String, trim: true },
      endDate: { type: String, trim: true },
      isCurrent: { type: Boolean, default: false },
      responsibilities: { type: String, trim: true },
    },
  ],
  // Compliance & Checks
  policeCheck: { type: String, trim: true },
  workingWithChildrenCheck: { type: String, trim: true },
  securityClearance: { type: String, trim: true },
  driversLicence: { type: String, trim: true },
  // Availability
  availableStartDate: { type: Date },
  noticePeriod: { type: String, trim: true },
  // Application Preferences
  howToApply: { type: String, trim: true },
  companiesToAvoid: { type: String, trim: true },
  // Additional Information
  anythingElse: { type: String, trim: true },
  // Consent & Authorisation
  consentInfoAccurate: { type: Boolean, default: false },
  consentSubmitApplications: { type: Boolean, default: false },
  consentAccountCreation: { type: Boolean, default: false },
  consentTermsAndPrivacy: { type: Boolean, default: false },
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
  // Purchased add-ons (one-time purchases like ATS Resume Rewrite)
  purchasedAddons: [{
    name: { type: String, required: true }, // e.g. 'resume_rewrite', 'linkedin_optimisation'
    purchasedAt: { type: Date, default: Date.now }
  }],
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
    },
    // Effective job caps after repurchase/upgrade (leftover + newly purchased package)
    jobApplicationsLimit: {
      type: Number,
      default: null
    },
    afmJobSearchLimit: {
      type: Number,
      default: null
    },
    customerProvidedJobLimit: {
      type: Number,
      default: null
    }
  },
  // ATS Resume Analysis Report
  atsReport: {
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    analyzedAt: {
      type: Date,
      default: null
    },
    summary: {
      type: String,
      trim: true
    },
    recommendations: [{
      category: {
        type: String,
        enum: ['formatting', 'keywords', 'structure', 'content', 'contact', 'other'],
        default: 'other'
      },
      severity: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium'
      },
      issue: {
        type: String,
        trim: true
      },
      suggestion: {
        type: String,
        trim: true
      }
    }],
    strengths: [{
      type: String,
      trim: true
    }],
    weaknesses: [{
      type: String,
      trim: true
    }],
    originalResumeKey: {
      type: String,
      trim: true
    },
    optimizedResumeKey: {
      type: String,
      trim: true
    },
    optimizedResumeDetails: {
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
    optimizedAt: {
      type: Date,
      default: null
    },
    optimizationScore: {
      type: Number,
      min: 0,
      max: 100,
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
