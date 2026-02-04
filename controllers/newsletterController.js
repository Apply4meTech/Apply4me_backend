const Newsletter = require('../models/Newsletter');

// Subscribe to newsletter
const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Basic email validation
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Normalize email (lowercase and trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingSubscription = await Newsletter.findOne({ email: normalizedEmail });

    if (existingSubscription) {
      // If already subscribed but inactive, reactivate it
      if (!existingSubscription.isActive) {
        existingSubscription.isActive = true;
        existingSubscription.subscribedAt = new Date();
        await existingSubscription.save();
        return res.status(200).json({
          success: true,
          message: 'Successfully subscribed to newsletter',
          email: normalizedEmail
        });
      }
      
      // Already subscribed and active
      return res.status(200).json({
        success: true,
        message: 'You are already subscribed to our newsletter',
        email: normalizedEmail
      });
    }

    // Create new subscription
    const newsletter = await Newsletter.create({
      email: normalizedEmail
    });

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      email: newsletter.email
    });
  } catch (error) {
    console.error('Error in newsletter subscription:', error);

    // Handle duplicate key error (email already exists)
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        message: 'You are already subscribed to our newsletter',
        email: req.body.email?.toLowerCase().trim()
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to newsletter',
      details: error.message
    });
  }
};

// Get all newsletter subscriptions (admin only)
const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Newsletter.find({ isActive: true })
      .sort({ subscribedAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      subscriptions
    });
  } catch (error) {
    console.error('Error fetching newsletter subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch newsletter subscriptions',
      details: error.message
    });
  }
};

module.exports = {
  subscribe,
  getAllSubscriptions
};

