const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  price: {
    type: Number,
    required: true,
    min: 0
  },
  
  actualPrice: {
    type: Number,
    min: 0,
    default: null // If null, no discount shown
  },
  
  currency: {
    type: String,
    default: 'AUD',
    enum: ['AUD', 'USD', 'EUR', 'GBP']
  },
  
  // Features array - each feature has text and included flag
  features: [{
    text: {
      type: String,
      required: true
    },
    included: {
      type: Boolean,
      default: true
    }
  }],
  
  // Plan display settings
  isPopular: {
    type: Boolean,
    default: false
  },
  
  badge: {
    type: String,
    default: null, // e.g., 'Most Popular', 'Best Value'
    trim: true
  },
  
  // Plan status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Display order
  displayOrder: {
    type: Number,
    default: 0,
    index: true
  },
  
  // Billing period options
  billingPeriod: {
    type: String,
    enum: ['onetime', 'monthly', 'quarterly', 'yearly'],
    default: 'onetime'
  },
  
  // Plan limits/quotas
  jobApplicationsLimit: {
    type: Number,
    default: null // null means unlimited
  },
  
  // Additional metadata
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Index for active plans query
planSchema.index({ isActive: 1, displayOrder: 1 });

// Virtual for discount percentage
planSchema.virtual('discountPercentage').get(function() {
  if (this.actualPrice && this.actualPrice > this.price) {
    return Math.round(((this.actualPrice - this.price) / this.actualPrice) * 100);
  }
  return 0;
});

const Plan = mongoose.model('Plan', planSchema);
module.exports = Plan;

