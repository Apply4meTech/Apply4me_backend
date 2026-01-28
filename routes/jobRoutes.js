const express = require('express');
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getJobById,
  updateJobStatus,
  deleteJob,
  getJobsByUserInfo,
  getAllUsers
} = require('../controllers/jobController');

// Job routes
router.post('/', createJob);
router.get('/', getAllJobs);
router.get('/users', getAllUsers); // Get all unique users
router.get('/by-user', getJobsByUserInfo); // Get jobs by user email/phone
router.get('/:id', getJobById);
router.patch('/:id', updateJobStatus);
router.delete('/:id', deleteJob);

module.exports = router;
