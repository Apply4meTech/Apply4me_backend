const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  analyzeResume,
  getATSReport,
  optimizeResume,
  downloadOptimizedResume
} = require('../controllers/resumeController');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Resume analysis routes
router.post('/analyze', analyzeResume); // POST /api/resume/analyze
router.get('/report', getATSReport); // GET /api/resume/report
router.post('/optimize', optimizeResume); // POST /api/resume/optimize
router.get('/optimized/download', downloadOptimizedResume); // GET /api/resume/optimized/download

module.exports = router;

