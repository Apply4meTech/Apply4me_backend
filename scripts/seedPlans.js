const mongoose = require('mongoose');
const Plan = require('../models/Plan');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';

// Plan data from the images
const plansData = [
  {
    name: 'Starter',
    price: 89,
    actualPrice: 119,
    description: '100 Job Applications',
    currency: 'AUD',
    billingPeriod: 'onetime',
    features: [
      { text: '100 Job Applications', included: true },
      { text: 'Human Assistant', included: true },
      { text: 'Standard cover letter (role-adjusted)', included: true },
      { text: 'Real-time progress updates', included: true }
    ],
    isPopular: false,
    badge: null,
    isActive: true,
    displayOrder: 1,
    jobApplicationsLimit: 100
  },
  {
    name: 'Standard',
    price: 149,
    actualPrice: 199,
    description: '175 Job Applications',
    currency: 'AUD',
    billingPeriod: 'onetime',
    features: [
      { text: '175 Job Applications', included: true },
      { text: 'Human Assistant', included: true },
      { text: 'Custom cover letters', included: true },
      { text: 'Resume created by us, ATS-aligned', included: true },
      { text: 'Real-time progress updates', included: true }
    ],
    isPopular: false,
    badge: null,
    isActive: true,
    displayOrder: 2,
    jobApplicationsLimit: 175
  },
  {
    name: 'Pro',
    price: 229,
    actualPrice: 299,
    description: '250 Job Applications',
    currency: 'AUD',
    billingPeriod: 'onetime',
    features: [
      { text: '250 Job Applications', included: true },
      { text: 'Human Assistant', included: true },
      { text: 'Custom cover letters', included: true },
      { text: 'Resume created by us for every job', included: true },
      { text: 'Real-time progress updates', included: true },
      { text: '1 Interview prep included + add-on', included: true }
    ],
    isPopular: true,
    badge: 'Most Popular',
    isActive: true,
    displayOrder: 3,
    jobApplicationsLimit: 250
  },
  {
    name: 'Premium',
    price: 329,
    actualPrice: 399,
    description: '350 Job Applications',
    currency: 'AUD',
    billingPeriod: 'onetime',
    features: [
      { text: '350 Job Applications', included: true },
      { text: 'Dedicated Human Assistant', included: true },
      { text: 'Custom cover letters', included: true },
      { text: 'Resume created by us for every job', included: true },
      { text: 'LinkedIn Profile Optimisation', included: true },
      { text: 'Priority Processing', included: true },
      { text: 'Real-time progress updates', included: true },
      { text: '3 Interview prep included + add-on', included: true }
    ],
    isPopular: false,
    badge: 'Best Value!',
    isActive: true,
    displayOrder: 4,
    jobApplicationsLimit: 350
  }
];

async function seedPlans() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process each plan
    for (const planData of plansData) {
      try {
        // Check if plan already exists
        const existingPlan = await Plan.findOne({ name: planData.name });

        if (existingPlan) {
          // Update existing plan
          Object.keys(planData).forEach(key => {
            existingPlan[key] = planData[key];
          });
          await existingPlan.save();
          console.log(`🔄 Updated plan: ${planData.name}`);
          updatedCount++;
        } else {
          // Create new plan
          await Plan.create(planData);
          console.log(`✅ Created plan: ${planData.name}`);
          createdCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing plan ${planData.name}:`, error.message);
        skippedCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${createdCount} plans`);
    console.log(`   🔄 Updated: ${updatedCount} plans`);
    console.log(`   ⚠️  Skipped: ${skippedCount} plans`);
    console.log(`   📦 Total: ${plansData.length} plans processed`);

    await mongoose.connection.close();
    console.log('\n✅ Database seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the seed function
seedPlans();


