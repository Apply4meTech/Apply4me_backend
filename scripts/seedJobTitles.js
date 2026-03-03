const mongoose = require('mongoose');
const JobTitle = require('../models/JobTitle');
require('dotenv').config();

const DEFAULT_JOB_TITLES = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Scientist',
  'Data Analyst',
  'Product Manager',
  'Project Manager',
  'UX Designer',
  'UI Designer',
  'DevOps Engineer',
  'QA Engineer',
  'Business Analyst',
  'Marketing Manager',
  'Sales Representative',
  'Customer Success Manager',
  'HR Manager',
  'Accountant',
  'Financial Analyst',
  'Content Writer',
  'Graphic Designer',
  'Mechanical Engineer',
  'Electrical Engineer',
  'Civil Engineer',
  'Nurse',
  'Teacher',
  'Consultant',
  'Architect',
  'Legal Counsel',
  'Operations Manager',
];

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';

async function seedJobTitles() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    let added = 0;
    for (const title of DEFAULT_JOB_TITLES) {
      const titleLower = title.toLowerCase();
      const existing = await JobTitle.findOne({ title: titleLower });
      if (!existing) {
        await JobTitle.create({
          title: titleLower,
          displayTitle: title,
          isDefault: true,
          usageCount: 0
        });
        added++;
      }
    }

    console.log(`✅ Job titles seeded. Added ${added} new titles (${DEFAULT_JOB_TITLES.length - added} already existed).`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding job titles:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedJobTitles();
