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
    description: '100 customer-provided jobs',
    currency: 'AUD',
    billingPeriod: 'onetime',
    features: [
      { text: '100 total job tokens', included: true },
      { text: 'All jobs provided by customer', included: true },
      { text: 'Human Assistant', included: true },
      { text: 'Standard cover letters', included: true },
      { text: 'Real-time progress updates', included: true }
    ],
    isPopular: false,
    badge: null,
    isActive: true,
    displayOrder: 1,
    jobApplicationsLimit: 100,
    afmJobSearchLimit: 0,
    customerProvidedJobLimit: 100
  },
  {
    name: 'Standard',
    price: 149,
    actualPrice: 199,
    description: '175 total job tokens',
    currency: 'AUD',
    billingPeriod: 'onetime',
    features: [
      { text: '175 total job tokens', included: true },
      { text: '90 jobs searched by AFM Team', included: true },
      { text: '85 jobs provided by customer', included: true },
      { text: 'Human Assistant', included: true },
      { text: 'Custom cover letters', included: true },
      { text: 'Resume Tailored Per Job', included: true },
      { text: 'Real-time progress updates', included: true }
    ],
    isPopular: false,
    badge: null,
    isActive: true,
    displayOrder: 2,
    jobApplicationsLimit: 175,
    afmJobSearchLimit: 90,
    customerProvidedJobLimit: 85
  },
  {
    name: 'Pro',
    price: 229,
    actualPrice: 299,
    description: '250 total job tokens',
    currency: 'AUD',
    billingPeriod: 'onetime',
    features: [
      { text: '250 total job tokens', included: true },
      { text: '190 jobs searched by AFM Team', included: true },
      { text: '60 jobs provided by customer', included: true },
      { text: 'Human Assistant', included: true },
      { text: 'Custom cover letters', included: true },
      { text: 'Resume Tailored Per Job', included: true },
      { text: 'Real-time progress updates', included: true },
      { text: '1 Interview prep Session', included: true }
    ],
    isPopular: true,
    badge: 'Most Popular',
    isActive: true,
    displayOrder: 3,
    jobApplicationsLimit: 250,
    afmJobSearchLimit: 190,
    customerProvidedJobLimit: 60
  },
  {
    name: 'Premium',
    price: 329,
    actualPrice: 399,
    description: '350 Jobs',
    currency: 'AUD',
    billingPeriod: 'onetime',
    features: [
      { text: '350 total job tokens', included: true },
      { text: 'All jobs searched by AFM Team', included: true },
      { text: 'Dedicated Human Assistant', included: true },
      { text: 'Custom cover letters', included: true },
      { text: 'Resume Tailored Per Job', included: true },
      { text: 'LinkedIn Profile Optimisation', included: true },
      { text: 'Priority Processing', included: true },
      { text: 'Real-time progress updates', included: true },
      { text: '3 Interview prep Sessions', included: true }
    ],
    isPopular: false,
    badge: 'Best Value!',
    isActive: true,
    displayOrder: 4,
    jobApplicationsLimit: 350,
    afmJobSearchLimit: 350,
    customerProvidedJobLimit: 0
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


