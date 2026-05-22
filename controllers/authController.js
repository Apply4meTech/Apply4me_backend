const User = require('../models/User');
const Employee = require('../models/Employee');
const Newsletter = require('../models/Newsletter');
const Affiliate = require('../models/Affiliate');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendRegistrationWelcomeEmail,
  sendNewCustomerJoinNotification,
} = require('../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper function to generate JWT token for User
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Helper function to generate JWT token for Employee (uses employeeId for employeeAuth middleware)
const generateEmployeeToken = (employeeId) => {
  return jwt.sign({ employeeId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Signup controller
const signup = async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, email, password' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        error: 'User with this email already exists' 
      });
    }

    // Resolve affiliate referral if code provided
    let referredBy = null;
    if (referralCode && referralCode.trim()) {
      const affiliate = await Affiliate.findOne({
        referralCode: referralCode.toUpperCase().trim(),
        status: 'active'
      });
      if (affiliate) referredBy = affiliate._id;
    }

    // Create new user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      ...(referredBy && { referredBy })
    });

    // Generate JWT token
    const token = generateToken(user._id);

    // Check if user is subscribed to newsletter
    const newsletterSubscription = await Newsletter.findOne({ 
      email: user.email.toLowerCase(),
      isActive: true 
    });
    const isNewsletterSubscribed = !!newsletterSubscription;

    sendRegistrationWelcomeEmail(user.email, user.name).catch((err) =>
      console.warn('[signup] registration email:', err.message)
    );

    sendNewCustomerJoinNotification({
      name: user.name,
      email: user.email,
      userId: user._id.toString(),
      createdAt: user.createdAt,
      referralCode: referredBy && referralCode?.trim() ? referralCode.trim().toUpperCase() : null,
    }).catch((err) => console.warn('[signup] new customer notify:', err.message));

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isOnboardingComplete: user.isOnboardingComplete || false,
        isNewsletterSubscribed: isNewsletterSubscribed,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error in signup:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        error: errors.join(', ') 
      });
    }

    // Handle duplicate key error (email already exists)
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user',
      details: error.message 
    });
  }
};

// Unified Login controller - handles both User and Employee (including super_admin)
// Single endpoint for all user types; tries User first, then Employee
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: email and password' 
      });
    }

    const emailLower = email.toLowerCase();

    // 1. Try User model first
    const user = await User.findOne({ email: emailLower });
    if (user) {
      const isPasswordValid = await user.comparePassword(password);
      if (isPasswordValid) {
        const token = generateToken(user._id);
        const newsletterSubscription = await Newsletter.findOne({ 
          email: emailLower,
          isActive: true 
        });
        const isNewsletterSubscribed = !!newsletterSubscription;

        // Check if user has active subscription (payment completed)
        const now = new Date();
        const hasActiveSubscription = !!(
          user.subscription?.planName &&
          user.subscription?.status === 'active' &&
          (!user.subscription?.endDate || new Date(user.subscription.endDate) >= now)
        );

        return res.json({
          success: true,
          message: 'Login successful',
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role || 'user',
            isOnboardingComplete: user.isOnboardingComplete || false,
            isNewsletterSubscribed: isNewsletterSubscribed,
            hasActiveSubscription,
            subscription: user.subscription || null,
            purchasedAddons: user.purchasedAddons || [],
            createdAt: user.createdAt
          }
        });
      }
    }

    // 2. Try Employee model (employee or super_admin)
    const employee = await Employee.findOne({ email: emailLower, isActive: true });
    if (employee) {
      const isPasswordValid = await employee.comparePassword(password);
      if (isPasswordValid) {
        const token = generateEmployeeToken(employee._id);
        return res.json({
          success: true,
          message: 'Login successful',
          token,
          user: {
            id: employee._id,
            name: employee.name,
            email: employee.email,
            role: employee.role,
            isEmployee: true,
            createdAt: employee.createdAt
          }
        });
      }
    }

    // Neither User nor Employee matched, or password invalid
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid email or password' 
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to login',
      details: error.message 
    });
  }
};

// Forgot Password controller
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    // For security, always return success message even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Set token and expiration (1 hour from now)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      // Send email
      await sendPasswordResetEmail(user.email, resetToken, resetUrl);
      
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (emailError) {
      // If email fails, clear the reset token
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('Error sending password reset email:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send password reset email. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
      details: error.message
    });
  }
};

// Reset Password controller
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Validation
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token and not expired
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired password reset token'
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send success email (don't wait for it)
    sendPasswordResetSuccessEmail(user.email).catch(err => {
      console.error('Error sending password reset success email:', err);
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      details: error.message
    });
  }
};

// Verify token controller (for Chrome extension)
const verify = async (req, res) => {
  try {
    // User is already attached to req by verifyToken middleware
    const user = req.user;
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isOnboardingComplete: user.isOnboardingComplete || false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error in verify:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify token',
      details: error.message
    });
  }
};

module.exports = {
  signup,
  login,
  generateToken,
  forgotPassword,
  resetPassword,
  verify
};
