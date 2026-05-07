/**
 * Remove "LinkedIn Profile Optimisation" from Premium plan features.
 * Run: node scripts/removePremiumLinkedinFeature.js
 */
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';

const PREMIUM_PLAN_ID = '698a10c05c9382552289720a';
const FEATURE_ID = '69e5b8867daa28d1f24a66a1';
const FEATURE_TEXT = 'LinkedIn Profile Optimisation';

async function removePremiumLinkedinFeature() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Prefer removing by feature subdocument _id for precision.
    const removeByIdResult = await Plan.updateOne(
      { _id: PREMIUM_PLAN_ID },
      { $pull: { features: { _id: FEATURE_ID } } }
    );

    if (removeByIdResult.modifiedCount > 0) {
      console.log('✅ Feature removed by feature _id');
    } else {
      // Fallback if the feature _id changed in this environment.
      const removeByTextResult = await Plan.updateOne(
        { _id: PREMIUM_PLAN_ID },
        { $pull: { features: { text: FEATURE_TEXT } } }
      );

      if (removeByTextResult.modifiedCount > 0) {
        console.log('✅ Feature removed by feature text');
      } else {
        console.log('ℹ️  No feature removed. It may already be deleted or plan/feature ids may differ.');
      }
    }

    const premiumPlan = await Plan.findById(PREMIUM_PLAN_ID).select('name features');
    if (!premiumPlan) {
      console.log('⚠️  Premium plan not found by provided plan _id.');
    } else {
      console.log(`\n📦 Plan: ${premiumPlan.name}`);
      console.log('Remaining features:');
      premiumPlan.features.forEach((feature, index) => {
        console.log(`  ${index + 1}. ${feature.text} (${feature.included ? 'included' : 'not included'})`);
      });
    }

    await mongoose.connection.close();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

removePremiumLinkedinFeature();
