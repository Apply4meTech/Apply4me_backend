const Settings = require('../models/Settings');
const Employee = require('../models/Employee');

/**
 * Get application settings (super admin only)
 * GET /api/settings
 */
const getSettings = async (req, res) => {
  try {
    const employee = req.employee;

    // Only super admin can view settings
    if (employee.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Only super admin can view settings'
      });
    }

    const settings = await Settings.getSettings();

    res.json({
      success: true,
      settings: {
        autoAssignEnabled: settings.autoAssignEnabled,
        updatedBy: settings.updatedBy,
        updatedAt: settings.updatedAt,
        createdAt: settings.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      details: error.message
    });
  }
};

/**
 * Update application settings (super admin only)
 * PATCH /api/settings
 */
const updateSettings = async (req, res) => {
  try {
    const employee = req.employee;
    const { autoAssignEnabled } = req.body;

    // Only super admin can update settings
    if (employee.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Only super admin can update settings'
      });
    }

    // Validate input
    if (typeof autoAssignEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'autoAssignEnabled must be a boolean value'
      });
    }

    const settings = await Settings.updateSettings(
      { autoAssignEnabled },
      employee._id
    );

    console.log(`⚙️ Settings updated by ${employee.name} (${employee.email}): autoAssignEnabled = ${autoAssignEnabled}`);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        autoAssignEnabled: settings.autoAssignEnabled,
        updatedBy: settings.updatedBy,
        updatedAt: settings.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      details: error.message
    });
  }
};

/**
 * Get employee job statistics (for super admin dashboard)
 * GET /api/settings/employee-stats
 */
const getEmployeeStats = async (req, res) => {
  try {
    const employee = req.employee;

    // Only super admin can view employee stats
    if (employee.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Only super admin can view employee statistics'
      });
    }

    const Job = require('../models/Job');

    // Get all active employees
    const employees = await Employee.find({
      role: 'employee',
      isActive: true
    }).select('_id name email');

    // Get job counts for each employee
    const employeeStats = await Promise.all(
      employees.map(async (emp) => {
        const pendingCount = await Job.countDocuments({
          assignedTo: emp._id,
          status: { $in: ['pending', 'assigned'] }
        });

        const totalCount = await Job.countDocuments({
          assignedTo: emp._id
        });

        return {
          id: emp._id,
          name: emp.name,
          email: emp.email,
          pendingJobs: pendingCount,
          totalJobs: totalCount
        };
      })
    );

    // Sort by pending jobs (ascending)
    employeeStats.sort((a, b) => a.pendingJobs - b.pendingJobs);

    res.json({
      success: true,
      employeeStats
    });
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee statistics',
      details: error.message
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getEmployeeStats
};

