const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');

// Verify JWT token middleware for employees
const verifyEmployeeToken = async (req, res, next) => {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Get employee from token
    const employee = await Employee.findById(decoded.employeeId).select('-password');
    
    if (!employee) {
      return res.status(401).json({ 
        success: false, 
        error: 'Employee not found. Token may be invalid.' 
      });
    }

    if (!employee.isActive) {
      return res.status(401).json({ 
        success: false, 
        error: 'Employee account is inactive.' 
      });
    }

    // Attach employee info to request object
    req.employeeId = decoded.employeeId;
    req.employee = employee;

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

    console.error('Employee auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
};

// Middleware to check if employee is super admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.employee) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    if (req.employee.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Super admin privileges required.' 
      });
    }

    next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authorization error' 
    });
  }
};

module.exports = { verifyEmployeeToken, requireSuperAdmin };

