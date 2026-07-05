const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const { uploadFile, deleteFile, getFileUrl } = require('../controllers/fileUploadController');

// Configure multer for file uploads (store in memory for S3 upload)
const storage = multer.memoryStorage();

const docMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const imageMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp'
];

const fileFilter = (req, file, cb) => {
  const type = (req.params.type || '').toLowerCase();
  let allowed = docMimeTypes;
  if (type === 'certifications' || type === 'visa_attachment') {
    allowed = [...docMimeTypes, ...imageMimeTypes];
  }
  if (type === 'cv' || type === 'cover_letter') {
    allowed = docMimeTypes; // PDF or DOCX only, no TXT
  }
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${type === 'certifications' || type === 'visa_attachment' ? 'PDF, DOC, DOCX, or images' : 'PDF, DOC, DOCX'}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (per spec for Resume)
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
