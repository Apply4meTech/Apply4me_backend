const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided.' 
      });
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token not found in Authorization header' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token (optional - fetch user from database)
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found. Token may be invalid.' 
      });
    }

    // Attach user info to request object
    req.userId = decoded.userId;
    req.user = user;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token has expired. Please login again.' 
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
};

module.exports = { verifyToken };
