const express = require('express');
const router = express.Router();
const { employeeLogin, createEmployee, getAllEmployees, updateEmployee } = require('../controllers/employeeController');
const { verifyEmployeeToken, requireSuperAdmin } = require('../middleware/employeeAuth');

// Public routes
router.post('/login', employeeLogin);

// Protected routes - require authentication
router.use(verifyEmployeeToken);

// Super admin only routes
router.post('/create', requireSuperAdmin, createEmployee);
router.get('/all', requireSuperAdmin, getAllEmployees);
router.put('/:employeeId', requireSuperAdmin, updateEmployee);

module.exports = router;

