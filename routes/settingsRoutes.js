const express = require('express');
const router = express.Router();
const { verifyEmployeeToken, requireSuperAdmin } = require('../middleware/employeeAuth');
const {
  getSettings,
  updateSettings,
  getEmployeeStats
} = require('../controllers/settingsController');

// All routes require employee authentication and super admin role
router.use(verifyEmployeeToken);
router.use(requireSuperAdmin);

// Settings routes
router.get('/', getSettings);
router.patch('/', updateSettings);
router.get('/employee-stats', getEmployeeStats);

module.exports = router;

