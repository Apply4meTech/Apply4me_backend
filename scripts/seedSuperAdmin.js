const mongoose = require('mongoose');
const Employee = require('../models/Employee');
require('dotenv').config();

// Super admin credentials (hardcoded as requested)
const SUPER_ADMIN_EMAIL = 'superadmin@applyforme.com';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin@123';
const SUPER_ADMIN_NAME = 'Super Admin';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';

async function seedSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await Employee.findOne({ 
      email: SUPER_ADMIN_EMAIL.toLowerCase(),
      role: 'super_admin'
    });

    if (existingSuperAdmin) {
      console.log('ℹ️  Super admin already exists. Skipping seed.');
      await mongoose.connection.close();
      return;
    }

    // Create super admin
    const superAdmin = await Employee.create({
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL.toLowerCase(),
      password: SUPER_ADMIN_PASSWORD,
      role: 'super_admin',
      isActive: true
    });

    console.log('✅ Super admin created successfully!');
    console.log('📧 Email:', SUPER_ADMIN_EMAIL);
    console.log('🔑 Password:', SUPER_ADMIN_PASSWORD);
    console.log('⚠️  Please change the password after first login for security.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding super admin:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the seed function
seedSuperAdmin();

