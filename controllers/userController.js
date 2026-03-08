const User = require('../models/User');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');

// Get current user profile (protected endpoint)
const getProfile = async (req, res) => {
  try {
    // User is already attached to req by verifyToken middleware
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch profile' 
    });
  }
};

// Update user profile (protected endpoint)
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.userId;

    // Build update object
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();

    // If email is being updated, check if it's already taken
    if (email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: userId } // Exclude current user
      });
      
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          error: 'Email already in use by another account' 
        });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        error: errors.join(', ') 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile' 
    });
  }
};

// Get user's current plan/subscription (protected endpoint)
const getMyPlan = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // If user has no subscription, return minimal data (may have add-ons only)
    if (!user.subscription || !user.subscription.planName) {
      return res.json({
        success: true,
        data: {
          subscription: null,
          purchasedAddons: user.purchasedAddons || [],
          plan: null,
          payment: null
        },
        message: 'No active plan found'
      });
    }

    // Get plan details from Plan collection
    const plan = await Plan.findOne({ name: user.subscription.planName, isActive: true });
    
    // Get payment details if available
    let paymentDetails = null;
    if (user.subscription.paymentId) {
      paymentDetails = await Payment.findById(user.subscription.paymentId)
        .select('amount currency status completedAt');
    }

    // Check if subscription is expired
    const now = new Date();
    const isExpired = user.subscription.endDate && new Date(user.subscription.endDate) < now;
    const status = isExpired ? 'expired' : (user.subscription.status || 'active');

    res.json({
      success: true,
      data: {
        plan: plan ? {
          id: plan._id,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          actualPrice: plan.actualPrice,
          currency: plan.currency,
          features: plan.features,
          badge: plan.badge,
          isPopular: plan.isPopular
        } : {
          name: user.subscription.planName,
        },
        subscription: {
          planName: user.subscription.planName,
          billingPeriod: user.subscription.billingPeriod,
          startDate: user.subscription.startDate,
          endDate: user.subscription.endDate,
          status: status
        },
        purchasedAddons: user.purchasedAddons || [],
        payment: paymentDetails
      }
    });
  } catch (error) {
    console.error('Error fetching user plan:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch plan information' 
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getMyPlan
};
