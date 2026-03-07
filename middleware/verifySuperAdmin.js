const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');

/**
 * Middleware that accepts BOTH User tokens (userId) and Employee tokens (employeeId)
 * for super_admin operations. Sets req.user for compatibility with existing controllers.
 * Use for routes that super_admin can access from either User or Employee dashboard.
 */
const verifySuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token not found in Authorization header',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Try Employee token first (employeeId)
    if (decoded.employeeId) {
      const employee = await Employee.findById(decoded.employeeId).select('-password');
      if (!employee) {
        return res.status(401).json({
          success: false,
          error: 'Employee not found. Token may be invalid.',
        });
      }
      if (!employee.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Employee account is inactive.',
        });
      }
      if (employee.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Super admin privileges required.',
        });
      }
      // Set req.user for compatibility with controllers expecting req.user
      req.user = {
        _id: employee._id,
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
      };
      req.userId = employee._id.toString();
      req.employee = employee;
      req.employeeId = employee._id;
      return next();
    }

    // Try User token (userId)
    if (decoded.userId) {
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found. Token may be invalid.',
        });
      }
      if (user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Super admin privileges required.',
        });
      }
      req.user = user;
      req.userId = user._id.toString();
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid token payload.',
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please login again.',
      });
    }
    console.error('verifySuperAdmin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
};

module.exports = { verifySuperAdmin };
