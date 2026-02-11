const Job = require('../models/Job');
const Employee = require('../models/Employee');

/**
 * Get dashboard data for employee/super admin
 * GET /api/employee/dashboard
 */
const getEmployeeDashboardData = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    const employee = req.employee;
    const isSuperAdmin = employee.role === 'super_admin';

    let query = {};
    
    // If not super admin, only show jobs assigned to this employee
    if (!isSuperAdmin) {
      query.assignedTo = employeeId;
    }

    // Get total jobs
    const totalJobs = await Job.countDocuments(query);

    // Get completed jobs (status: 'completed')
    const totalCompleted = await Job.countDocuments({
      ...query,
      status: 'completed'
    });

    // Get pending jobs (status: 'pending' or 'assigned')
    const totalPending = await Job.countDocuments({
      ...query,
      status: { $in: ['pending', 'assigned'] }
    });

    // Get jobs with details
    const jobs = await Job.find(query)
      .populate('userId', 'name email fullName')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Format jobs
    const formattedJobs = jobs.map(job => ({
      id: job._id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      applicant: job.userId ? (job.userId.fullName || job.userId.name || 'N/A') : 'N/A',
      applicantEmail: job.userId ? job.userId.email : null,
      assignedTo: job.assignedTo ? job.assignedTo.name : null,
      status: job.status,
      link: job.jobUrl,
      date: job.createdAt,
      platform: job.platform || 'Unknown',
      emailData: job.emailData || null,
      resume: job.resume || null,
      coverLetter: job.coverLetter || null,
      screenshotProof: job.screenshotProof || null,
      notes: job.notes || '',
      notesUpdatedAt: job.notesUpdatedAt || null
    }));

    res.json({
      success: true,
      data: {
        totalJobs,
        totalCompleted,
        totalPending,
        jobs: formattedJobs
      }
    });
  } catch (error) {
    console.error('Error fetching employee dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
};

module.exports = {
  getEmployeeDashboardData
};
