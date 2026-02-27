const Job = require('../models/Job');
const { uploadFileToS3, deleteFileFromS3, getSignedUrl, getFileBufferFromS3 } = require('../utils/s3Service');
const { extractResumeText } = require('../utils/resumeExtractor');
const { customizeResumeForJob } = require('../utils/resumeCustomizer');
const { generateATSFriendlyPDF } = require('../utils/pdfGenerator');

/**
 * Update job status
 * PATCH /api/employee/jobs/:jobId/status
 */
const updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    const employeeId = req.employeeId;
    const employee = req.employee;

    // Validate status
    const validStatuses = ['pending', 'assigned', 'applied', 'response', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // If not super admin, check if job is assigned to this employee
    if (employee.role !== 'super_admin') {
      if (!job.assignedTo || job.assignedTo.toString() !== employeeId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update this job'
        });
      }
    }

    // Update status
    const updateData = { 
      status,
      updatedAt: Date.now()
    };

    // If status is 'assigned' and not already assigned, set assignedTo
    if (status === 'assigned' && !job.assignedTo) {
      updateData.assignedTo = employeeId;
      updateData.assignedAt = new Date();
    }

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    )
      .populate('userId', 'name email fullName')
      .populate('assignedTo', 'name email')
      .lean();

    res.json({
      success: true,
      message: 'Job status updated successfully',
      job: {
        id: updatedJob._id,
        jobTitle: updatedJob.title,
        company: updatedJob.company,
        status: updatedJob.status,
        assignedTo: updatedJob.assignedTo ? updatedJob.assignedTo.name : null
      }
    });
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job status',
      details: error.message
    });
  }
};

/**
 * Update job email data and optionally send email
 * PATCH /api/employee/jobs/:jobId/email
 * Body: { emailAddress, subject, body, sent, sendEmail: true/false }
 */
const updateJobEmailData = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { emailAddress, subject, body, sent, sendEmail } = req.body;
    const employeeId = req.employeeId;
    const employee = req.employee;

    // Find job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // If not super admin, check if job is assigned to this employee
    if (employee.role !== 'super_admin') {
      if (!job.assignedTo || job.assignedTo.toString() !== employeeId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update this job'
        });
      }
    }

    // Prepare email data
    const finalEmailAddress = emailAddress || job.emailData?.emailAddress || '';
    const finalSubject = subject || job.emailData?.subject || '';
    const finalBody = body || job.emailData?.body || '';
    const shouldSend = sendEmail === true;
    const isSent = sent !== undefined ? sent : (shouldSend ? true : (job.emailData?.sent || false));

    // If sendEmail is true, actually send the email
    let emailSent = false;
    let emailError = null;
    
    if (shouldSend && finalEmailAddress) {
      try {
        const { sendJobApplicationEmail } = require('../utils/emailService');
        const { getSignedUrl } = require('../utils/s3Service');
        const User = require('../models/User');
        
        // Prepare attachments from job files
        // Use signed URLs for S3 files or direct URLs if public
        const attachments = [];
        
        // Get user to check for optimized resume
        let resumeToUse = job.resume; // Default to job's resume
        if (job.userId) {
          const user = await User.findById(job.userId).select('atsReport resume_details');
          // Prefer optimized resume if available, otherwise use original
          if (user?.atsReport?.optimizedResumeDetails?.url) {
            resumeToUse = user.atsReport.optimizedResumeDetails;
          } else if (user?.resume_details?.url && !job.resume?.url) {
            // If job doesn't have a resume but user has one, use user's resume
            resumeToUse = user.resume_details;
          }
        }
        
        if (resumeToUse?.url) {
          let attachmentUrl = resumeToUse.url;
          // If file is in S3 and has a key, generate signed URL
          if (resumeToUse.key && !resumeToUse.url.includes('http')) {
            try {
              attachmentUrl = await getSignedUrl(resumeToUse.key, 3600); // 1 hour expiry
            } catch (signedUrlError) {
              console.error('Error generating signed URL for resume:', signedUrlError);
              // Fall back to original URL
            }
          }
          attachments.push({
            filename: resumeToUse.fileName || 'resume.pdf',
            path: attachmentUrl
          });
        }
        
        if (job.coverLetter?.url) {
          let attachmentUrl = job.coverLetter.url;
          if (job.coverLetter.key && !job.coverLetter.url.includes('http')) {
            try {
              attachmentUrl = await getSignedUrl(job.coverLetter.key, 3600);
            } catch (signedUrlError) {
              console.error('Error generating signed URL for cover letter:', signedUrlError);
            }
          }
          attachments.push({
            filename: job.coverLetter.fileName || 'cover-letter.pdf',
            path: attachmentUrl
          });
        }
        
        if (job.screenshotProof?.url) {
          let attachmentUrl = job.screenshotProof.url;
          if (job.screenshotProof.key && !job.screenshotProof.url.includes('http')) {
            try {
              attachmentUrl = await getSignedUrl(job.screenshotProof.key, 3600);
            } catch (signedUrlError) {
              console.error('Error generating signed URL for screenshot:', signedUrlError);
            }
          }
          attachments.push({
            filename: job.screenshotProof.fileName || 'screenshot-proof.png',
            path: attachmentUrl
          });
        }

        await sendJobApplicationEmail(finalEmailAddress, finalSubject, finalBody, attachments);
        emailSent = true;
        console.log(`✅ Email sent successfully to ${finalEmailAddress} for job ${job.title} at ${job.company}`);
      } catch (emailSendError) {
        console.error('Error sending email:', emailSendError);
        emailError = emailSendError.message;
        // Continue to save email data even if sending fails
      }
    }

    // Update email data
    const emailData = {
      emailAddress: finalEmailAddress,
      subject: finalSubject,
      body: finalBody,
      sent: emailSent ? true : isSent,
      sentAt: emailSent ? new Date() : (isSent ? (job.emailData?.sentAt || new Date()) : null)
    };

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { 
        emailData,
        updatedAt: Date.now()
      },
      { new: true }
    )
      .populate('userId', 'name email fullName')
      .populate('assignedTo', 'name email')
      .lean();

    if (shouldSend && !emailSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to send email',
        details: emailError || 'Email sending failed',
        job: {
          id: updatedJob._id,
          emailData: updatedJob.emailData
        }
      });
    }

    res.json({
      success: true,
      message: shouldSend && emailSent 
        ? 'Email sent successfully' 
        : 'Email data updated successfully',
      emailSent: emailSent,
      job: {
        id: updatedJob._id,
        emailData: updatedJob.emailData
      }
    });
  } catch (error) {
    console.error('Error updating job email data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update email data',
      details: error.message
    });
  }
};

/**
 * Upload file for job (resume, cover letter, or screenshot proof)
 * POST /api/employee/jobs/:jobId/files/:fileType
 */
const uploadJobFile = async (req, res) => {
  try {
    const { jobId, fileType } = req.params;
    const employeeId = req.employeeId;
    const employee = req.employee;

    // Validate file type
    const validFileTypes = ['resume', 'coverLetter', 'screenshotProof'];
    if (!validFileTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid file type. Must be one of: ${validFileTypes.join(', ')}`
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    // Find job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // If not super admin, check if job is assigned to this employee
    if (employee.role !== 'super_admin') {
      if (!job.assignedTo || job.assignedTo.toString() !== employeeId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update this job'
        });
      }
    }

    // Delete old file from S3 if exists
    const oldFileKey = job[fileType]?.key;
    if (oldFileKey) {
      try {
        await deleteFileFromS3(oldFileKey);
      } catch (error) {
        console.error(`Error deleting old ${fileType}:`, error);
        // Continue even if deletion fails
      }
    }

    // Upload to S3
    const folder = fileType === 'screenshotProof' ? 'screenshots' : (fileType === 'resume' ? 'resumes' : 'cover-letters');
    const uploadResult = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    // Prepare file details object
    const fileDetails = {
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      resourceId: uploadResult.resourceId,
      url: uploadResult.url,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      mimeType: uploadResult.mimeType,
      uploadedAt: uploadResult.uploadedAt || new Date()
    };

    // Update job
    const updateData = {
      [fileType]: fileDetails,
      updatedAt: Date.now()
    };

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    ).lean();

    res.json({
      success: true,
      message: `${fileType} uploaded successfully`,
      fileDetails: fileDetails
    });
  } catch (error) {
    console.error('Error uploading job file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
};

/**
 * Delete file from job
 * DELETE /api/employee/jobs/:jobId/files/:fileType
 */
const deleteJobFile = async (req, res) => {
  try {
    const { jobId, fileType } = req.params;
    const employeeId = req.employeeId;
    const employee = req.employee;

    // Validate file type
    const validFileTypes = ['resume', 'coverLetter', 'screenshotProof'];
    if (!validFileTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid file type. Must be one of: ${validFileTypes.join(', ')}`
      });
    }

    // Find job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // If not super admin, check if job is assigned to this employee
    if (employee.role !== 'super_admin') {
      if (!job.assignedTo || job.assignedTo.toString() !== employeeId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update this job'
        });
      }
    }

    // Delete from S3
    if (job[fileType] && job[fileType].key) {
      try {
        await deleteFileFromS3(job[fileType].key);
      } catch (error) {
        console.error(`Error deleting ${fileType} from S3:`, error);
        // Continue to delete from database even if S3 deletion fails
      }
    }

    // Delete from database
    await Job.findByIdAndUpdate(jobId, {
      $unset: { [fileType]: 1 },
      updatedAt: Date.now()
    });

    res.json({
      success: true,
      message: `${fileType} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting job file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      details: error.message
    });
  }
};

/**
 * Delete job
 * DELETE /api/employee/jobs/:jobId
 */
const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employeeId = req.employeeId;
    const employee = req.employee;

    // Find job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // If not super admin, check if job is assigned to this employee
    if (employee.role !== 'super_admin') {
      if (!job.assignedTo || job.assignedTo.toString() !== employeeId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to delete this job'
        });
      }
    }

    // Delete files from S3
    const filesToDelete = ['resume', 'coverLetter', 'screenshotProof'];
    for (const fileType of filesToDelete) {
      if (job[fileType] && job[fileType].key) {
        try {
          await deleteFileFromS3(job[fileType].key);
        } catch (error) {
          console.error(`Error deleting ${fileType} from S3:`, error);
        }
      }
    }

    // Delete job
    await Job.findByIdAndDelete(jobId);

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job',
      details: error.message
    });
  }
};

/**
 * Assign job to employee (super admin only)
 * PATCH /api/employee/jobs/:jobId/assign
 */
const assignJobToEmployee = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { employeeId } = req.body;
    const employee = req.employee;

    // Only super admin can assign jobs
    if (employee.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Only super admin can assign jobs to employees'
      });
    }

    // Validate employeeId
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID is required'
      });
    }

    // Find job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Verify employee exists
    const Employee = require('../models/Employee');
    const assignedEmployee = await Employee.findById(employeeId);
    
    if (!assignedEmployee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Update job assignment
    const updateData = {
      assignedTo: employeeId,
      assignedAt: new Date(),
      status: job.status === 'pending' ? 'assigned' : job.status, // Auto-update status if pending
      updatedAt: Date.now()
    };

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    )
      .populate('userId', 'name email fullName')
      .populate('assignedTo', 'name email')
      .lean();

    res.json({
      success: true,
      message: 'Job assigned to employee successfully',
      job: {
        id: updatedJob._id,
        jobTitle: updatedJob.title,
        company: updatedJob.company,
        status: updatedJob.status,
        assignedTo: updatedJob.assignedTo ? {
          id: updatedJob.assignedTo._id,
          name: updatedJob.assignedTo.name,
          email: updatedJob.assignedTo.email
        } : null
      }
    });
  } catch (error) {
    console.error('Error assigning job to employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign job to employee',
      details: error.message
    });
  }
};

/**
 * Unassign job from employee (super admin only)
 * PATCH /api/employee/jobs/:jobId/unassign
 */
const unassignJobFromEmployee = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employee = req.employee;

    // Only super admin can unassign jobs
    if (employee.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Only super admin can unassign jobs from employees'
      });
    }

    // Find job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Update job to remove assignment
    const updateData = {
      assignedTo: null,
      assignedAt: null,
      status: 'pending', // Reset to pending when unassigned
      updatedAt: Date.now()
    };

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    )
      .populate('userId', 'name email fullName')
      .populate('assignedTo', 'name email')
      .lean();

    res.json({
      success: true,
      message: 'Job unassigned successfully',
      job: {
        id: updatedJob._id,
        jobTitle: updatedJob.title,
        company: updatedJob.company,
        status: updatedJob.status,
        assignedTo: null
      }
    });
  } catch (error) {
    console.error('Error unassigning job from employee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unassign job from employee',
      details: error.message
    });
  }
};

/**
 * Update job notes
 * PATCH /api/employee/jobs/:jobId/notes
 */
const updateJobNotes = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { notes } = req.body;
    const employeeId = req.employeeId;
    const employee = req.employee;

    // Find job
    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // If not super admin, check if job is assigned to this employee
    if (employee.role !== 'super_admin') {
      if (!job.assignedTo || job.assignedTo.toString() !== employeeId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update this job'
        });
      }
    }

    // Update notes
    const updateData = {
      notes: notes || '',
      notesUpdatedAt: new Date(),
      notesUpdatedBy: employeeId,
      updatedAt: Date.now()
    };

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    )
      .populate('userId', 'name email fullName')
      .populate('assignedTo', 'name email')
      .populate('notesUpdatedBy', 'name email')
      .lean();

    res.json({
      success: true,
      message: 'Notes updated successfully',
      job: {
        id: updatedJob._id,
        notes: updatedJob.notes,
        notesUpdatedAt: updatedJob.notesUpdatedAt,
        notesUpdatedBy: updatedJob.notesUpdatedBy ? {
          id: updatedJob.notesUpdatedBy._id,
          name: updatedJob.notesUpdatedBy.name,
          email: updatedJob.notesUpdatedBy.email
        } : null
      }
    });
  } catch (error) {
    console.error('Error updating job notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notes',
      details: error.message
    });
  }
};

/**
 * Update job metadata (e.g. job description pasted by employee)
 * PATCH /api/employee/jobs/:jobId/metadata
 * Body: { description } (optional: salary, requirements)
 */
const updateJobMetadata = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { description, salary, requirements } = req.body;
    const employeeId = req.employeeId;
    const employee = req.employee;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    if (employee.role !== 'super_admin') {
      if (!job.assignedTo || job.assignedTo.toString() !== employeeId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update this job'
        });
      }
    }

    const updateData = { updatedAt: Date.now() };
    if (job.metadata && typeof job.metadata === 'object') {
      updateData.metadata = { ...job.metadata };
    } else {
      updateData.metadata = {};
    }
    if (description !== undefined) updateData.metadata.description = description;
    if (salary !== undefined) updateData.metadata.salary = salary;
    if (requirements !== undefined) updateData.metadata.requirements = requirements;

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      updateData,
      { new: true }
    ).lean();

    res.json({
      success: true,
      message: 'Job metadata updated successfully',
      metadata: updatedJob.metadata || null
    });
  } catch (error) {
    console.error('Error updating job metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job metadata',
      details: error.message
    });
  }
};

/**
 * Generate customized resume for job (non-Starter plans only)
 * POST /api/employee/jobs/:jobId/customize-resume
 * Returns download URL and fileName. Employee downloads then uploads to job + screenshot.
 */
const customizeResume = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { description: descriptionFromBody } = req.body || {};
    const employeeId = req.employeeId;
    const employee = req.employee;

    const job = await Job.findById(jobId).populate('userId', 'subscription.planName resume_details atsReport.optimizedResumeDetails');
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    if (employee.role !== 'super_admin') {
      if (!job.assignedTo || job.assignedTo.toString() !== employeeId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to customize resume for this job'
        });
      }
    }

    const user = job.userId;
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Job has no associated user'
      });
    }

    const planName = user.subscription?.planName || null;
    if (!planName || planName === 'Starter') {
      return res.status(403).json({
        success: false,
        error: 'Customized resume is only available for Standard, Pro, and Premium plans. This user is on Starter plan.'
      });
    }

    // Resolve user's resume: prefer optimized, else resume_details (from populated userId)
    const resumeDetails = user.atsReport?.optimizedResumeDetails || user.resume_details;
    if (!resumeDetails || !resumeDetails.key) {
      return res.status(400).json({
        success: false,
        error: 'User has no resume on file. Please ensure the user has uploaded a resume.'
      });
    }

    let resumeBuffer;
    try {
      resumeBuffer = await getFileBufferFromS3(resumeDetails.key);
    } catch (err) {
      console.error('Error fetching resume from S3:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to load user resume'
      });
    }

    const resumeText = await extractResumeText(resumeBuffer, resumeDetails.mimeType || 'application/pdf');
    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract enough text from the resume. Ensure the file is a valid PDF or DOCX.'
      });
    }

    // Use description from request body (e.g. unsaved paste) or from job.metadata
    const jobDescription = (typeof descriptionFromBody === 'string' && descriptionFromBody.trim())
      ? descriptionFromBody.trim()
      : ((job.metadata && job.metadata.description) || job.title || '');
    if (!jobDescription || jobDescription.length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Please add or paste the job description (at least 20 characters) in Fill Data, then try again.'
      });
    }

    const customizedText = await customizeResumeForJob(resumeText, jobDescription.trim());
    const pdfBuffer = await generateATSFriendlyPDF(customizedText);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const jobIdShort = job._id.toString().slice(-6);
    const fileName = `Resume_${jobIdShort}_${dateStr}_${timeStr}.pdf`;

    const folder = 'customized-resumes';
    const uploadResult = await uploadFileToS3(pdfBuffer, fileName, 'application/pdf', folder);

    const downloadUrl = await getSignedUrl(uploadResult.key, 3600);

    res.json({
      success: true,
      message: 'Customized resume generated. Download and upload it to this job, then upload screenshot proof.',
      downloadUrl,
      fileName: uploadResult.fileName,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Error customizing resume:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate customized resume',
      details: error.message
    });
  }
};

module.exports = {
  updateJobStatus,
  updateJobEmailData,
  uploadJobFile,
  deleteJobFile,
  deleteJob,
  assignJobToEmployee,
  unassignJobFromEmployee,
  updateJobNotes,
  updateJobMetadata,
  customizeResume
};
