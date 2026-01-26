const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const { getProfile, updateProfile, uploadProfilePicture, deleteProfilePicture } = require('../controllers/profileController');

// Configure multer for profile picture uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: JPEG, JPG, PNG, GIF, WEBP'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
}).single('picture');

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

// Apply authentication middleware to all routes
router.use(verifyToken);

// Profile routes
router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/picture', uploadMiddleware, uploadProfilePicture);
router.delete('/picture', deleteProfilePicture);

module.exports = router;
