const Plan = require('../models/Plan');

/**
 * Get all active plans (public endpoint)
 * GET /api/plans
 */
const getAllPlans = async (req, res) => {
  try {
    const { activeOnly = 'true' } = req.query;
    
    const query = activeOnly === 'true' ? { isActive: true } : {};
    
    const plans = await Plan.find(query)
      .sort({ displayOrder: 1, createdAt: 1 })
      .select('-metadata')
      .lean();

    res.json({
      success: true,
      data: plans,
      count: plans.length
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans',
      details: error.message
    });
  }
};

/**
 * Get single plan by ID (public endpoint)
 * GET /api/plans/:id
 */
const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const plan = await Plan.findById(id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plan',
      details: error.message
    });
  }
};

/**
 * Create new plan (super admin only)
 * POST /api/plans
 */
const createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      actualPrice,
      currency,
      features,
      isPopular,
      badge,
      isActive,
      displayOrder,
      billingPeriod,
      jobApplicationsLimit,
      metadata
    } = req.body;

    // Validation
    if (!name || !description || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, description, price'
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Price must be greater than or equal to 0'
      });
    }

    // Check if plan with same name already exists
    const existingPlan = await Plan.findOne({ name: name.trim() });
    if (existingPlan) {
      return res.status(409).json({
        success: false,
        error: 'Plan with this name already exists'
      });
    }

    // Create plan
    const plan = await Plan.create({
      name: name.trim(),
      description: description.trim(),
      price,
      actualPrice: actualPrice || null,
      currency: currency || 'AUD',
      features: features || [],
      isPopular: isPopular || false,
      badge: badge || null,
      isActive: isActive !== undefined ? isActive : true,
      displayOrder: displayOrder || 0,
      billingPeriod: billingPeriod || 'onetime',
      jobApplicationsLimit: jobApplicationsLimit || null,
      metadata: metadata || {}
    });

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Plan with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create plan',
      details: error.message
    });
  }
};

/**
 * Update plan (super admin only)
 * PUT /api/plans/:id
 */
const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find plan
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    // If name is being updated, check for duplicates
    if (updateData.name && updateData.name !== plan.name) {
      const existingPlan = await Plan.findOne({ name: updateData.name.trim() });
      if (existingPlan) {
        return res.status(409).json({
          success: false,
          error: 'Plan with this name already exists'
        });
      }
      updateData.name = updateData.name.trim();
    }

    // Update plan
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        plan[key] = updateData[key];
      }
    });

    await plan.save();

    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Plan with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update plan',
      details: error.message
    });
  }
};

/**
 * Delete plan (super admin only)
 * DELETE /api/plans/:id
 */
const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    // Soft delete - set isActive to false instead of actually deleting
    plan.isActive = false;
    await plan.save();

    res.json({
      success: true,
      message: 'Plan deleted successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete plan',
      details: error.message
    });
  }
};

/**
 * Seed default plans (super admin only)
 * POST /api/plans/seed
 */
const seedPlans = async (req, res) => {
  try {
    // Plan data
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

    let createdCount = 0;
    let updatedCount = 0;
    const results = [];

    // Process each plan
    for (const planData of plansData) {
      try {
        // Check if plan already exists
        const existingPlan = await Plan.findOne({ name: planData.name });

        if (existingPlan) {
          // Update existing plan
          Object.keys(planData).forEach(key => {
            if (key !== '_id' && key !== '__v') {
              existingPlan[key] = planData[key];
            }
          });
          await existingPlan.save();
          results.push({ name: planData.name, action: 'updated' });
          updatedCount++;
        } else {
          // Create new plan
          const newPlan = await Plan.create(planData);
          results.push({ name: planData.name, action: 'created', id: newPlan._id });
          createdCount++;
        }
      } catch (error) {
        results.push({ name: planData.name, action: 'error', error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Plans seeded successfully. Created: ${createdCount}, Updated: ${updatedCount}`,
      results,
      createdCount,
      updatedCount,
      total: plansData.length
    });
  } catch (error) {
    console.error('Error seeding plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed plans',
      details: error.message
    });
  }
};

module.exports = {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  seedPlans
};

