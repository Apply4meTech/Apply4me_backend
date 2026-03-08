const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  deleteBlogImage,
  toggleLike,
  toggleBookmark
} = require('../controllers/blogController');
const { verifyEmployeeToken, requireSuperAdmin } = require('../middleware/employeeAuth');
const { optionalAuth } = require('../middleware/optionalAuth');

// Configure multer for image uploads (store in memory for S3 upload)
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: JPEG, JPG, PNG, GIF, WEBP'), false);
  }
};

// Configure multer for multiple image fields
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: imageFilter
}).fields([
  { name: 'featuredImage', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]);

// Middleware wrapper for multer
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
};

// Custom middleware that accepts BOTH User and Employee tokens.
// Sets req.userId for both (for like/bookmark filtering) so blog features work for all user types.
const optionalUserOrEmployeeAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // If no auth header, continue without authentication
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.userId = null;
    req.user = null;
    req.employee = null;
    return optionalAuth(req, res, next); // optionalAuth will set req.userId=null and call next()
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    req.userId = null;
    req.user = null;
    req.employee = null;
    return optionalAuth(req, res, next);
  }

  // Try Employee token first (super admin, employees)
  try {
    const jwt = require('jsonwebtoken');
    const Employee = require('../models/Employee');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.employeeId) {
      const employee = await Employee.findById(decoded.employeeId).select('-password');
      if (employee && employee.isActive) {
        req.employee = employee;
        req.employeeId = decoded.employeeId;
        req.userId = decoded.employeeId.toString(); // For like/bookmark - use employeeId as actor
        return next();
      }
    }
  } catch (err) {
    // Not an employee token or invalid, continue to user auth
  }

  // Fall back to User token (normal users)
  return optionalAuth(req, res, next);
};

router.get('/', optionalUserOrEmployeeAuth, getAllBlogs); // GET /api/blogs - Get all published blogs

// User interaction routes - accept both User and Employee tokens (for normal users, employees, super admin)
router.post('/:id/like', optionalUserOrEmployeeAuth, toggleLike); // POST /api/blogs/:id/like - Like/Unlike blog
router.post('/:id/bookmark', optionalUserOrEmployeeAuth, toggleBookmark); // POST /api/blogs/:id/bookmark - Bookmark/Unbookmark blog

router.get('/:id', optionalUserOrEmployeeAuth, getBlogById); // GET /api/blogs/:id - Get blog by ID or slug

// Admin routes (require super admin authentication)
router.post('/', verifyEmployeeToken, requireSuperAdmin, uploadMiddleware, createBlog); // POST /api/blogs - Create blog
router.put('/:id', verifyEmployeeToken, requireSuperAdmin, uploadMiddleware, updateBlog); // PUT /api/blogs/:id - Update blog
router.delete('/:id', verifyEmployeeToken, requireSuperAdmin, deleteBlog); // DELETE /api/blogs/:id - Delete blog
router.delete('/:id/images/:imageId', verifyEmployeeToken, requireSuperAdmin, deleteBlogImage); // DELETE /api/blogs/:id/images/:imageId - Delete image from blog

module.exports = router;

