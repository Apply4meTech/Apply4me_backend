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

// Custom middleware that tries employee auth, then falls back to optional auth
const optionalEmployeeOrUserAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // If no auth header, continue without authentication
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return optionalAuth(req, res, next);
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return optionalAuth(req, res, next);
  }

  // Try to verify as employee token first
  try {
    const jwt = require('jsonwebtoken');
    const Employee = require('../models/Employee');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.employeeId) {
      const employee = await Employee.findById(decoded.employeeId).select('-password');
      if (employee && employee.isActive) {
        req.employee = employee;
        req.employeeId = decoded.employeeId;
        return next();
      }
    }
  } catch (err) {
    // Not an employee token or invalid, continue to optional auth
  }

  // Fall back to optional user auth
  return optionalAuth(req, res, next);
};

router.get('/', optionalEmployeeOrUserAuth, getAllBlogs); // GET /api/blogs - Get all published blogs

// User interaction routes (require user authentication via optionalAuth) - must come before /:id
router.post('/:id/like', optionalAuth, toggleLike); // POST /api/blogs/:id/like - Like/Unlike blog
router.post('/:id/bookmark', optionalAuth, toggleBookmark); // POST /api/blogs/:id/bookmark - Bookmark/Unbookmark blog

router.get('/:id', optionalEmployeeOrUserAuth, getBlogById); // GET /api/blogs/:id - Get blog by ID or slug

// Admin routes (require super admin authentication)
router.post('/', verifyEmployeeToken, requireSuperAdmin, uploadMiddleware, createBlog); // POST /api/blogs - Create blog
router.put('/:id', verifyEmployeeToken, requireSuperAdmin, uploadMiddleware, updateBlog); // PUT /api/blogs/:id - Update blog
router.delete('/:id', verifyEmployeeToken, requireSuperAdmin, deleteBlog); // DELETE /api/blogs/:id - Delete blog
router.delete('/:id/images/:imageId', verifyEmployeeToken, requireSuperAdmin, deleteBlogImage); // DELETE /api/blogs/:id/images/:imageId - Delete image from blog

module.exports = router;

