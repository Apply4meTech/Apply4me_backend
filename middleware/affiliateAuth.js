const jwt = require('jsonwebtoken');
const Affiliate = require('../models/Affiliate');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const verifyAffiliateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token not found.' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const affiliate = await Affiliate.findById(decoded.affiliateId).select('-password');
    if (!affiliate) {
      return res.status(401).json({ success: false, error: 'Affiliate not found.' });
    }
    if (affiliate.status !== 'active') {
      return res.status(401).json({ success: false, error: 'Affiliate account is inactive.' });
    }
    req.affiliateId = decoded.affiliateId;
    req.affiliate = affiliate;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired. Please login again.' });
    }
    console.error('Affiliate auth error:', error);
    res.status(500).json({ success: false, error: 'Authentication error' });
  }
};

module.exports = { verifyAffiliateToken };
