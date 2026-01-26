const Employee = require('../models/Employee');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Service');

/**
 * Get employee profile
 * GET /api/employee/profile
 */
const getEmployeeProfile = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    
    const employee = await Employee.findById(employeeId).select('-password');
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.json({
      success: true,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        profilePicture: employee.profilePicture || null,
        isActive: employee.isActive,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      details: error.message
    });
  }
};

/**
 * Update employee profile
 * PUT /api/employee/profile
 */
const updateEmployeeProfile = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    const { name, email } = req.body;

    // Build update object
    const updateData = {
      updatedAt: Date.now()
    };

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
      message: 'Profile updated successfully',
      employee: {
        id: updatedEmployee._id,
        name: updatedEmployee.name,
        email: updatedEmployee.email,
        role: updatedEmployee.role,
        profilePicture: updatedEmployee.profilePicture || null,
        isActive: updatedEmployee.isActive,
        updatedAt: updatedEmployee.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating employee profile:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: error.message
    });
  }
};

/**
 * Upload employee profile picture
 * POST /api/employee/profile/picture
 */
const uploadEmployeeProfilePicture = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    // Get employee to check for existing profile picture
    const employee = await Employee.findById(employeeId);
    
    // Delete old profile picture from S3 if exists
    if (employee.profilePicture && employee.profilePicture.key) {
      try {
        await deleteFileFromS3(employee.profilePicture.key);
      } catch (error) {
        console.error('Error deleting old profile picture:', error);
        // Continue even if deletion fails
      }
    }

    // Upload to S3
    const uploadResult = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'profile-pictures' // Use same folder as user profiles
    );

    // Prepare profile picture object
    const profilePicture = {
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      resourceId: uploadResult.resourceId,
      url: uploadResult.url,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      mimeType: uploadResult.mimeType,
      uploadedAt: uploadResult.uploadedAt || new Date()
    };

    // Save to database
    await Employee.findByIdAndUpdate(employeeId, {
      profilePicture: profilePicture
    });

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: profilePicture
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload profile picture',
      details: error.message
    });
  }
};

/**
 * Delete employee profile picture
 * DELETE /api/employee/profile/picture
 */
const deleteEmployeeProfilePicture = async (req, res) => {
  try {
    const employeeId = req.employeeId;
    
    const employee = await Employee.findById(employeeId);
    
    if (!employee.profilePicture || !employee.profilePicture.key) {
      return res.status(404).json({
        success: false,
        error: 'Profile picture not found'
      });
    }

    // Delete from S3
    try {
      await deleteFileFromS3(employee.profilePicture.key);
    } catch (error) {
      console.error('Error deleting profile picture from S3:', error);
      // Continue to delete from database even if S3 deletion fails
    }

    // Delete from database
    await Employee.findByIdAndUpdate(employeeId, {
      $unset: { profilePicture: 1 }
    });

    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete profile picture',
      details: error.message
    });
  }
};

module.exports = {
  getEmployeeProfile,
  updateEmployeeProfile,
  uploadEmployeeProfilePicture,
  deleteEmployeeProfilePicture
};
