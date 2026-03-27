const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // User details
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment identifiers
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  merchantTransactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Amount details
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  
  currency: {
    type: String,
    default: 'INR'
  },
  
  // Payment status
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['UPI', 'CARD', 'NET_BANKING', 'WALLET', 'STRIPE'],
    default: 'STRIPE'
  },
  
  // Payment gateway response data
  paymentResponse: {
    type: Object,
    default: {}
  },
  
  // Stripe specific fields
  stripePaymentIntentId: {
    type: String,
    index: true
  },
  
  stripePaymentId: {
    type: String,
    index: true
  },
  
  // Gateway used for payment
  gateway: {
    type: String,
    enum: ['STRIPE'],
    default: 'STRIPE'
  },
  
  // Subscription/Plan details
  planName: {
    type: String
  },
  
  billingPeriod: {
    type: String,
    enum: ['monthly', 'quarterly', 'onetime']
  },
  
  // Additional metadata
  metadata: {
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    redirectUrl: String
  },
  
  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  
  completedAt: Date,

  /** Set when payment receipt email was sent successfully (idempotency / retry) */
  receiptEmailSentAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ stripePaymentId: 1 });
paymentSchema.index({ gateway: 1, status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;

