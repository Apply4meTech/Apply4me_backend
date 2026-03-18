const Affiliate = require('../models/Affiliate');
const AffiliateClick = require('../models/AffiliateClick');
const AffiliateCommission = require('../models/AffiliateCommission');
const User = require('../models/User');
const Payment = require('../models/Payment');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Register affiliate (HR influencer)
 * POST /api/affiliate/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password required' });
    }
    const existing = await Affiliate.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    const affiliate = await Affiliate.create({
      name,
      email: email.toLowerCase(),
      password
    });
    const token = jwt.sign({ affiliateId: affiliate._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({
      success: true,
      message: 'Affiliate registered successfully',
      token,
      affiliate: {
        id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        referralCode: affiliate.referralCode,
        referralLink: `${FRONTEND_URL}/signup?ref=${affiliate.referralCode}`
      }
    });
  } catch (error) {
    console.error('Affiliate register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
};

/**
 * Affiliate login
 * POST /api/affiliate/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    const affiliate = await Affiliate.findOne({ email: email.toLowerCase() });
    if (!affiliate || !(await affiliate.comparePassword(password))) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    if (affiliate.status !== 'active') {
      return res.status(401).json({ success: false, error: 'Account is inactive' });
    }
    const token = jwt.sign({ affiliateId: affiliate._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
      success: true,
      token,
      affiliate: {
        id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        referralCode: affiliate.referralCode,
        referralLink: `${FRONTEND_URL}/signup?ref=${affiliate.referralCode}`
      }
    });
  } catch (error) {
    console.error('Affiliate login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};

/**
 * Get affiliate dashboard stats
 * GET /api/affiliate/dashboard
 */
const getDashboard = async (req, res) => {
  try {
    const affiliateId = req.affiliateId;
    const totalClicks = await AffiliateClick.countDocuments({ affiliateId });
    const totalSuccessfulClosures = await AffiliateCommission.countDocuments({ affiliateId });
    const commissions = await AffiliateCommission.find({ affiliateId }).lean();
    const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
    const unpaidCommission = commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);
    const affiliate = await Affiliate.findById(affiliateId).select('referralCode name email');
    res.json({
      success: true,
      data: {
        totalClicks,
        totalSuccessfulClosures,
        totalCommission,
        unpaidCommission,
        referralCode: affiliate.referralCode,
        referralLink: `${FRONTEND_URL}/signup?ref=${affiliate.referralCode}`
      }
    });
  } catch (error) {
    console.error('Affiliate dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
};

/**
 * Log click (public - no auth)
 * POST /api/affiliate/click
 * Body: { referralCode }
 */
const logClick = async (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) {
      return res.status(400).json({ success: false, error: 'Referral code required' });
    }
    const affiliate = await Affiliate.findOne({
      referralCode: referralCode.toUpperCase().trim(),
      status: 'active'
    });
    if (!affiliate) {
      return res.status(404).json({ success: false, error: 'Invalid referral code' });
    }
    await AffiliateClick.create({
      affiliateId: affiliate._id,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    res.json({ success: true, message: 'Click recorded' });
  } catch (error) {
    console.error('Affiliate click error:', error);
    res.status(500).json({ success: false, error: 'Failed to record click' });
  }
};

/**
 * Validate referral code (public)
 * GET /api/affiliate/validate/:code
 */
const validateCode = async (req, res) => {
  try {
    const { code } = req.params;
    const affiliate = await Affiliate.findOne({
      referralCode: (code || '').toUpperCase().trim(),
      status: 'active'
    });
    res.json({
      success: true,
      valid: !!affiliate,
      referralCode: affiliate?.referralCode || null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Validation failed' });
  }
};

module.exports = {
  register,
  login,
  getDashboard,
  logClick,
  validateCode
};
