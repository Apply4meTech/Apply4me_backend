const express = require('express');
const router = express.Router();
const {
  getJobTitles,
  addJobTitle,
  getJobTitlesAdmin,
  createJobTitleAdmin,
  updateJobTitleAdmin,
  deleteJobTitleAdmin
} = require('../controllers/jobTitleController');
const { verifySuperAdmin } = require('../middleware/verifySuperAdmin');

// Public routes - no auth required for signup/onboarding journey
router.get('/', getJobTitles);
router.post('/', addJobTitle);

// Super admin routes - master data CRUD
router.get('/admin', verifySuperAdmin, getJobTitlesAdmin);
router.post('/admin', verifySuperAdmin, createJobTitleAdmin);
router.put('/admin/:id', verifySuperAdmin, updateJobTitleAdmin);
router.delete('/admin/:id', verifySuperAdmin, deleteJobTitleAdmin);

module.exports = router;
