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
const { verifySuperAdmin } = require('../middleware/verifySuperAdmin');

// Public routes
router.get('/', getAllPlans);
router.get('/:id', getPlanById);

// Protected routes (super admin only - accepts both User and Employee tokens)
router.post('/', verifySuperAdmin, createPlan);
router.post('/seed', verifySuperAdmin, seedPlans);
router.put('/:id', verifySuperAdmin, updatePlan);
router.delete('/:id', verifySuperAdmin, deletePlan);

module.exports = router;

