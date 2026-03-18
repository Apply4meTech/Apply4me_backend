const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyEmployeeToken } = require('../middleware/employeeAuth');
const { getEmployeeDashboardData } = require('../controllers/employeeDashboardController');
const { 
  updateJobStatus, 
  updateJobEmailData, 
  uploadJobFile, 
  deleteJobFile, 
  deleteJob,
  assignJobToEmployee,
  unassignJobFromEmployee,
  updateJobNotes,
  updateJobMetadata,
  customizeResume
} = require('../controllers/jobManagementController');
const {
  getEmployeeProfile,
  updateEmployeeProfile,
  uploadEmployeeProfilePicture,
  deleteEmployeeProfilePicture
} = require('../controllers/employeeProfileController');
const { getCustomerProfile } = require('../controllers/employeeCustomerController');
const { listAffiliates, markCommissionsPaid } = require('../controllers/employeeAffiliateController');
const { requireSuperAdmin } = require('../middleware/employeeAuth');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // For profile picture uploads, use image types
  if (req.path.includes('/profile/picture')) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: JPEG, JPG, PNG, GIF, WEBP'), false);
    }
    return;
  }

  // For job file uploads
  const fileType = req.params.fileType;
  
  // Different allowed types for different file types
  const allowedTypes = {
    resume: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    coverLetter: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    screenshotProof: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
  };
  
  const allowed = allowedTypes[fileType] || allowedTypes.resume;
  
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${fileType}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Create separate upload handlers
const uploadSingle = upload.single('file');
const uploadPicture = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: JPEG, JPG, PNG, GIF, WEBP'), false);
    }
  }
}).single('picture');

// Middleware wrapper for multer (for job files)
const uploadMiddleware = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
};

// Middleware for profile picture upload
const uploadPictureMiddleware = (req, res, next) => {
  uploadPicture(req, res, (err) => {
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
router.use(verifyEmployeeToken);

// Dashboard route
router.get('/dashboard', getEmployeeDashboardData);

// Customer profile (read-only for employees)
router.get('/customers/:userId', getCustomerProfile);

// Affiliates (super admin only)
router.get('/affiliates', requireSuperAdmin, listAffiliates);
router.patch('/affiliates/:id/mark-paid', requireSuperAdmin, markCommissionsPaid);

// Profile routes
router.get('/profile', getEmployeeProfile);
router.put('/profile', updateEmployeeProfile);
router.post('/profile/picture', uploadPictureMiddleware, uploadEmployeeProfilePicture);
router.delete('/profile/picture', deleteEmployeeProfilePicture);

// Job management routes
router.patch('/jobs/:jobId/status', updateJobStatus);
router.patch('/jobs/:jobId/email', updateJobEmailData);
router.patch('/jobs/:jobId/notes', updateJobNotes);
router.patch('/jobs/:jobId/metadata', updateJobMetadata);
router.post('/jobs/:jobId/customize-resume', customizeResume);
router.patch('/jobs/:jobId/assign', assignJobToEmployee);
router.patch('/jobs/:jobId/unassign', unassignJobFromEmployee);
router.post('/jobs/:jobId/files/:fileType', uploadMiddleware, uploadJobFile);
router.delete('/jobs/:jobId/files/:fileType', deleteJobFile);
router.delete('/jobs/:jobId', deleteJob);

module.exports = router;
