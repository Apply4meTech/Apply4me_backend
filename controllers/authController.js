const User = require('../models/User');
const Newsletter = require('../models/Newsletter');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendPasswordResetSuccessEmail } = require('../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Signup controller
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

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

    // Create new user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password
    });

    // Generate JWT token
    const token = generateToken(user._id);

    // Check if user is subscribed to newsletter
    const newsletterSubscription = await Newsletter.findOne({ 
      email: user.email.toLowerCase(),
      isActive: true 
    });
    const isNewsletterSubscribed = !!newsletterSubscription;

    
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

// Login controller
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

    // Find user by email (password will be included by default in our model)
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Check if user is subscribed to newsletter
    const newsletterSubscription = await Newsletter.findOne({ 
      email: user.email.toLowerCase(),
      isActive: true 
    });
    const isNewsletterSubscribed = !!newsletterSubscription;

    
    res.json({
      success: true,
      message: 'Login successful',
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

module.exports = {
  signup,
  login,
  generateToken,
  forgotPassword,
  resetPassword
};
