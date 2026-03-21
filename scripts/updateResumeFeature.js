/**
 * Update "Resume created by us" feature text to "Custom Resumes" in all plans.
 * Run: node scripts/updateResumeFeature.js
 *
 * Alternatively, re-run seedPlans.js to sync all plan data from code.
 */
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';

const OLD_TEXTS = [
  'Resume created by us, ATS-aligned',
  'Resume created by us for every job',
];
const NEW_TEXT = 'Custom Resumes';

async function updateResumeFeature() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const plans = await Plan.find({ 'features.text': { $in: OLD_TEXTS } });
    let updatedCount = 0;

    for (const plan of plans) {
      let changed = false;
      for (const f of plan.features) {
        if (OLD_TEXTS.includes(f.text)) {
          f.text = NEW_TEXT;
          changed = true;
        }
      }
      if (changed) {
        await plan.save();
        updatedCount++;
        console.log(`🔄 Updated plan: ${plan.name}`);
      }
    }

    if (updatedCount === 0) {
      console.log('ℹ️  No plans needed updating (feature may already be "Custom Resumes")');
    } else {
      console.log(`\n✅ Total: ${updatedCount} plan(s) updated`);
    }

    await mongoose.connection.close();
    console.log('✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

updateResumeFeature();
