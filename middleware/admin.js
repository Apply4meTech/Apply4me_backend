// Middleware to check if user is super admin
// This should be used AFTER verifyToken middleware
const isSuperAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated (should be set by verifyToken)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Check if user has super admin role
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Super admin privileges required.'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = { isSuperAdmin };

