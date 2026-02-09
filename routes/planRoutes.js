const express = require('express');
const router = express.Router();
const {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  seedPlans
} = require('../controllers/planController');
const { verifyToken } = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/admin');

// Public routes
router.get('/', getAllPlans);
router.get('/:id', getPlanById);

// Protected routes (super admin only)
router.post('/', verifyToken, isSuperAdmin, createPlan);
router.post('/seed', verifyToken, isSuperAdmin, seedPlans);
router.put('/:id', verifyToken, isSuperAdmin, updatePlan);
router.delete('/:id', verifyToken, isSuperAdmin, deletePlan);

module.exports = router;

