const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper function to generate JWT token
const generateToken = (employeeId) => {
  return jwt.sign({ employeeId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Employee Login controller
const employeeLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: email and password' 
      });
    }

    // Find employee by email
    const employee = await Employee.findOne({ email: email.toLowerCase(), isActive: true });
    
    if (!employee) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Compare password
    const isPasswordValid = await employee.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = generateToken(employee._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        createdAt: employee.createdAt
      }
    });
  } catch (error) {
    console.error('Error in employee login:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to login',
      details: error.message 
    });
  }
};

// Create Employee (only by super admin)
const createEmployee = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, email, password' 
      });
    }

    // Check if employee already exists
    const existingEmployee = await Employee.findOne({ email: email.toLowerCase() });
    
    if (existingEmployee) {
      return res.status(409).json({ 
        success: false, 
        error: 'Employee with this email already exists' 
      });
    }

    // Create new employee
    const employee = await Employee.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'employee',
      createdBy: req.employeeId // Set by auth middleware
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        createdAt: employee.createdAt
      }
    });
  } catch (error) {
    console.error('Error in create employee:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        error: errors.join(', ') 
      });
    }

    // Handle duplicate key error (email already exists)
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to create employee',
      details: error.message 
    });
  }
};

// Get all employees (only by super admin)
const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ role: 'employee' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      employees
    });
  } catch (error) {
    console.error('Error in get all employees:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch employees',
      details: error.message 
    });
  }
};

// Update Employee (only by super admin)
const updateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { name, email, password, isActive } = req.body;

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        error: 'Employee not found' 
      });
    }

    // Only allow editing employees, not super admins
    if (employee.role === 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot edit super admin account' 
      });
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) {
      // Check if email is already taken by another employee
      const existingEmployee = await Employee.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: employeeId }
      });
      
      if (existingEmployee) {
        return res.status(409).json({ 
          success: false, 
          error: 'Email already in use by another employee' 
        });
      }
      updateData.email = email.toLowerCase();
    }
    if (password !== undefined) updateData.password = password;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update employee
    const updatedEmployee = await Employee.findByIdAndUpdate(
      employeeId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedEmployee) {
      return res.status(404).json({ 
        success: false, 
        error: 'Employee not found' 
      });
    }

    res.json({
      success: true,
      message: 'Employee updated successfully',
      employee: {
        id: updatedEmployee._id,
        name: updatedEmployee.name,
        email: updatedEmployee.email,
        role: updatedEmployee.role,
        isActive: updatedEmployee.isActive,
        createdAt: updatedEmployee.createdAt,
        updatedAt: updatedEmployee.updatedAt
      }
    });
  } catch (error) {
    console.error('Error in update employee:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        error: errors.join(', ') 
      });
    }

    // Handle duplicate key error (email already exists)
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to update employee',
      details: error.message 
    });
  }
};

module.exports = {
  employeeLogin,
  createEmployee,
  getAllEmployees,
  updateEmployee,
  generateToken
};

