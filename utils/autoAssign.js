const Employee = require('../models/Employee');
const Job = require('../models/Job');

/**
 * Find the employee with the least number of pending/assigned jobs
 * @returns {Promise<Object|null>} Employee object or null if no active employees
 */
async function findEmployeeWithLeastJobs() {
  try {
    // Get all active employees (excluding super_admin)
    const employees = await Employee.find({
      role: 'employee',
      isActive: true
    }).select('_id name email');

    if (employees.length === 0) {
      console.log('⚠️ No active employees found for auto-assignment');
      return null;
    }

    // Get pending job counts for each employee
    const employeeJobCounts = await Promise.all(
      employees.map(async (employee) => {
        const pendingCount = await Job.countDocuments({
          assignedTo: employee._id,
          status: { $in: ['pending', 'assigned'] }
        });

        return {
          employee,
          pendingCount
        };
      })
    );

    // Sort by pending count (ascending) and return the employee with least jobs
    employeeJobCounts.sort((a, b) => a.pendingCount - b.pendingCount);

    const selectedEmployee = employeeJobCounts[0].employee;
    const selectedCount = employeeJobCounts[0].pendingCount;

    console.log(`✅ Auto-assign: Selected employee ${selectedEmployee.name} (${selectedEmployee.email}) with ${selectedCount} pending jobs`);

    return selectedEmployee;
  } catch (error) {
    console.error('Error finding employee with least jobs:', error);
    return null;
  }
}

/**
 * Auto-assign a job to an employee with the least pending jobs
 * @param {Object} jobId - The job ID to assign
 * @returns {Promise<Object|null>} Assigned employee or null if assignment failed
 */
async function autoAssignJob(jobId) {
  try {
    const employee = await findEmployeeWithLeastJobs();

    if (!employee) {
      console.log('⚠️ Could not auto-assign job: No available employees');
      return null;
    }

    // Update job with assignment
    const job = await Job.findByIdAndUpdate(
      jobId,
      {
        assignedTo: employee._id,
        assignedAt: new Date(),
        status: 'assigned',
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!job) {
      console.error('⚠️ Job not found for auto-assignment');
      return null;
    }

    console.log(`✅ Auto-assigned job "${job.title}" at ${job.company} to ${employee.name} (${employee.email})`);

    return {
      employee,
      job
    };
  } catch (error) {
    console.error('Error auto-assigning job:', error);
    return null;
  }
}

module.exports = {
  findEmployeeWithLeastJobs,
  autoAssignJob
};

