const mongoose = require('mongoose');

const AffiliateClickSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true,
    index: true
  },
  ipAddress: { type: String, trim: true },
  userAgent: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
});

AffiliateClickSchema.index({ affiliateId: 1, createdAt: -1 });

module.exports = mongoose.model('AffiliateClick', AffiliateClickSchema);
