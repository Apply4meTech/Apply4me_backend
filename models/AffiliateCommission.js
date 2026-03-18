const mongoose = require('mongoose');

const AffiliateCommissionSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending',
    index: true
  },
  paidAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

AffiliateCommissionSchema.index({ affiliateId: 1, status: 1 });

module.exports = mongoose.model('AffiliateCommission', AffiliateCommissionSchema);
