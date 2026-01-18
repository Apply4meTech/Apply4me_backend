const express = require('express');
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getJobById,
  updateJobStatus,
  deleteJob
} = require('../controllers/jobController');

// Job routes
router.post('/', createJob);
router.get('/', getAllJobs);
router.get('/:id', getJobById);
router.patch('/:id', updateJobStatus);
router.delete('/:id', deleteJob);

module.exports = router;
