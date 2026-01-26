const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const { uploadFile, deleteFile, getFileUrl } = require('../controllers/fileUploadController');

// Configure multer for file uploads (store in memory for S3 upload)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: PDF, DOC, DOCX, TXT'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
}).single('file');

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

// File upload routes
router.post('/:type', uploadMiddleware, uploadFile); // POST /api/upload/resume or /api/upload/cv
router.delete('/:type', deleteFile); // DELETE /api/upload/resume or /api/upload/cv
router.get('/:type/url', getFileUrl); // GET /api/upload/resume/url or /api/upload/cv/url

module.exports = router;
