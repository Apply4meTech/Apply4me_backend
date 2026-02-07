const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Optional JWT token verification middleware
// This middleware will attach userId if token is valid, but won't fail if token is missing
const optionalAuth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without userId (for public endpoints)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.userId = null;
      req.user = null;
      return next();
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.split(' ')[1];

    if (!token) {
      req.userId = null;
      req.user = null;
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user) {
        // Attach user info to request object
        req.userId = decoded.userId;
        req.user = user;
      } else {
        req.userId = null;
        req.user = null;
      }
    } catch (tokenError) {
      // If token is invalid or expired, just continue without userId
      // This allows the endpoint to work for both authenticated and unauthenticated requests
      req.userId = null;
      req.user = null;
    }

    next();
  } catch (error) {
    // On any error, continue without userId
    console.error('Optional auth middleware error:', error);
    req.userId = null;
    req.user = null;
    next();
  }
};

module.exports = { optionalAuth };

