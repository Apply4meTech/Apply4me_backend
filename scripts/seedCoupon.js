/**
 * Seed a 100% off coupon. Run from Apply4me_backend:
 *   node scripts/seedCoupon.js
 *   node scripts/seedCoupon.js APPLY100
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';
const code = (process.argv[2] || process.env.COUPON_CODE || 'APPLY100').toUpperCase();

async function seed() {
  await mongoose.connect(MONGODB_URI);
  const coupon = await Coupon.findOneAndUpdate(
    { code },
    {
      code,
      discountPercent: 100,
      isActive: true,
      maxUses: null,
      description: '100% off — full plan access without payment'
    },
    { upsert: true, new: true }
  );
  console.log('Coupon ready:', {
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    isActive: coupon.isActive
  });
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
