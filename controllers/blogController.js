const Blog = require('../models/Blog');
const mongoose = require('mongoose');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Service');

/**
 * Create a new blog post
 * POST /api/blogs
 * Requires: Super Admin authentication
 */
const createBlog = async (req, res) => {
  try {
    const { title, description, content, tags, status, authorName } = req.body;
    const employeeId = req.employeeId;
    const employee = req.employee;

    // Validation
    if (!title || !description || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, description, and content are required'
      });
    }

    // Generate unique slug
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Check if slug already exists and make it unique
    let slugExists = await Blog.findOne({ slug });
    let uniqueSlug = slug;
    let counter = 1;
    while (slugExists) {
      uniqueSlug = `${slug}-${counter}`;
      slugExists = await Blog.findOne({ slug: uniqueSlug });
      counter++;
    }

    // Handle featured image upload if provided
    let featuredImage = null;
    if (req.files && req.files.featuredImage) {
      const file = Array.isArray(req.files.featuredImage) ? req.files.featuredImage[0] : req.files.featuredImage;
      const uploadResult = await uploadFileToS3(
        file.buffer,
        file.originalname,
        file.mimetype,
        'blogs/featured-images'
      );
      featuredImage = uploadResult;
    }

    // Handle additional images if provided
    let images = [];
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      
      for (const image of imageFiles) {
        const uploadResult = await uploadFileToS3(
          image.buffer,
          image.originalname,
          image.mimetype,
          'blogs/images'
        );
        images.push(uploadResult);
      }
    }

    // Parse tags if it's a string
    let parsedTags = [];
    if (tags) {
      if (typeof tags === 'string') {
        parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(tags)) {
        parsedTags = tags.map(tag => typeof tag === 'string' ? tag.trim() : tag).filter(tag => tag);
      }
    }

    // Create blog
    const blog = await Blog.create({
      title,
      description,
      content,
      featuredImage,
      images,
      author: employeeId,
      authorName: authorName || employee.name,
      slug: uniqueSlug,
      status: status || 'published',
      tags: parsedTags
    });

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      blog
    });
  } catch (error) {
    console.error('Error in create blog:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    // Handle duplicate key error (slug already exists)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Blog with this title already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create blog',
      details: error.message
    });
  }
};

/**
 * Get all published blogs (public)
 * GET /api/blogs
 * Query params: status, page, limit, filter (liked, bookmarked)
 */
const getAllBlogs = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, filter } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const userId = req.userId; // From optionalAuth middleware

    // Build query - if not admin, only show published blogs
    const query = {};
    // Check if user is super admin (from employee token)
    const isSuperAdmin = req.employee && req.employee.role === 'super_admin';
    
    if (!isSuperAdmin) {
      query.status = 'published';
    } else if (status && status !== 'all') {
      query.status = status;
    }
    // If status is 'all' and user is super admin, don't filter by status

    // Handle filter for liked/bookmarked blogs
    if (filter === 'liked' || filter === 'bookmarked') {
      // Filter requires authentication
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required to filter by liked or bookmarked blogs'
        });
      }

      // Add filter to query based on filter type
      // MongoDB will match documents where the array contains the userId
      // Convert userId to ObjectId if it's a valid ObjectId string
      const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;
      
      if (filter === 'liked') {
        query.likes = userObjectId;
      } else if (filter === 'bookmarked') {
        query.bookmarks = userObjectId;
      }
    }

    // Get total count
    const total = await Blog.countDocuments(query);

    // Get blogs
    let blogs = await Blog.find(query)
      .select('-content') // Don't send full content in list view
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('author', 'name email')
      .lean();

    // Add like and bookmark counts and user status to each blog
    blogs = blogs.map(blog => {
      const blogObj = { ...blog };
      blogObj.likeCount = blog.likes ? blog.likes.length : 0;
      blogObj.bookmarkCount = blog.bookmarks ? blog.bookmarks.length : 0;
      
      // Check if current user has liked/bookmarked (if authenticated)
      if (userId) {
        blogObj.isLiked = blog.likes && blog.likes.some(
          likeId => likeId.toString() === userId.toString()
        );
        blogObj.isBookmarked = blog.bookmarks && blog.bookmarks.some(
          bookmarkId => bookmarkId.toString() === userId.toString()
        );
      } else {
        blogObj.isLiked = false;
        blogObj.isBookmarked = false;
      }
      
      return blogObj;
    });

    res.json({
      success: true,
      blogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error in get all blogs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blogs',
      details: error.message
    });
  }
};

/**
 * Get blog by ID or slug
 * GET /api/blogs/:id
 */
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if id is a valid ObjectId or a slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    let blog;
    if (isObjectId) {
      blog = await Blog.findById(id).populate('author', 'name email');
    } else {
      blog = await Blog.findOne({ slug: id }).populate('author', 'name email');
    }

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found'
      });
    }

    // Only show published blogs to non-admins
    if (blog.status !== 'published' && (!req.employee || req.employee.role !== 'super_admin')) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found'
      });
    }

    // Increment views
    blog.views += 1;
    await blog.save();

    // Convert blog to object to add computed fields
    const blogObj = blog.toObject();
    
    // Add like and bookmark counts
    blogObj.likeCount = blog.likes ? blog.likes.length : 0;
    blogObj.bookmarkCount = blog.bookmarks ? blog.bookmarks.length : 0;
    
    // Check if current user has liked/bookmarked (if authenticated)
    blogObj.isLiked = req.userId && blog.likes && blog.likes.some(
      likeId => likeId.toString() === req.userId.toString()
    );
    blogObj.isBookmarked = req.userId && blog.bookmarks && blog.bookmarks.some(
      bookmarkId => bookmarkId.toString() === req.userId.toString()
    );

    res.json({
      success: true,
      blog: blogObj
    });
  } catch (error) {
    console.error('Error in get blog by id:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blog',
      details: error.message
    });
  }
};

/**
 * Update blog
 * PUT /api/blogs/:id
 * Requires: Super Admin authentication
 */
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, tags, status, authorName } = req.body;

    // Find blog
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found'
      });
    }

    // Update fields
    if (title !== undefined) {
      blog.title = title;
      // Regenerate slug if title changed
      let slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Check if new slug already exists (excluding current blog)
      let slugExists = await Blog.findOne({ slug, _id: { $ne: id } });
      let uniqueSlug = slug;
      let counter = 1;
      while (slugExists) {
        uniqueSlug = `${slug}-${counter}`;
        slugExists = await Blog.findOne({ slug: uniqueSlug, _id: { $ne: id } });
        counter++;
      }
      blog.slug = uniqueSlug;
    }
    
    if (description !== undefined) blog.description = description;
    if (content !== undefined) blog.content = content;
    if (status !== undefined) blog.status = status;
    if (authorName !== undefined) blog.authorName = authorName;

    // Handle tags
    if (tags !== undefined) {
      let parsedTags = [];
      if (typeof tags === 'string') {
        parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(tags)) {
        parsedTags = tags.map(tag => typeof tag === 'string' ? tag.trim() : tag).filter(tag => tag);
      }
      blog.tags = parsedTags;
    }

    // Handle featured image update if provided
    if (req.files && req.files.featuredImage) {
      // Delete old featured image if exists
      if (blog.featuredImage && blog.featuredImage.key) {
        try {
          await deleteFileFromS3(blog.featuredImage.key);
        } catch (error) {
          console.error('Error deleting old featured image:', error);
        }
      }

      const file = Array.isArray(req.files.featuredImage) ? req.files.featuredImage[0] : req.files.featuredImage;
      const uploadResult = await uploadFileToS3(
        file.buffer,
        file.originalname,
        file.mimetype,
        'blogs/featured-images'
      );
      blog.featuredImage = uploadResult;
    }

    // Handle additional images if provided
    if (req.files && req.files.images) {
      const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      
      for (const image of imageFiles) {
        const uploadResult = await uploadFileToS3(
          image.buffer,
          image.originalname,
          image.mimetype,
          'blogs/images'
        );
        blog.images.push(uploadResult);
      }
    }

    await blog.save();

    res.json({
      success: true,
      message: 'Blog updated successfully',
      blog
    });
  } catch (error) {
    console.error('Error in update blog:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update blog',
      details: error.message
    });
  }
};

/**
 * Delete blog
 * DELETE /api/blogs/:id
 * Requires: Super Admin authentication
 */
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Find blog
    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found'
      });
    }

    // Delete featured image from S3
    if (blog.featuredImage && blog.featuredImage.key) {
      try {
        await deleteFileFromS3(blog.featuredImage.key);
      } catch (error) {
        console.error('Error deleting featured image:', error);
      }
    }

    // Delete all images from S3
    if (blog.images && blog.images.length > 0) {
      for (const image of blog.images) {
        if (image.key) {
          try {
            await deleteFileFromS3(image.key);
          } catch (error) {
            console.error('Error deleting image:', error);
          }
        }
      }
    }

    // Delete blog from database
    await Blog.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Error in delete blog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete blog',
      details: error.message
    });
  }
};

/**
 * Delete image from blog
 * DELETE /api/blogs/:id/images/:imageId
 * Requires: Super Admin authentication
 */
const deleteBlogImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    const blog = await Blog.findById(id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found'
      });
    }

    // Find and remove image
    const imageIndex = blog.images.findIndex(img => img._id.toString() === imageId);
    
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    const image = blog.images[imageIndex];
    
    // Delete from S3
    if (image.key) {
      try {
        await deleteFileFromS3(image.key);
      } catch (error) {
        console.error('Error deleting image from S3:', error);
      }
    }

    // Remove from array
    blog.images.splice(imageIndex, 1);
    await blog.save();

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error in delete blog image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image',
      details: error.message
    });
  }
};

/**
 * Like/Unlike a blog
 * POST /api/blogs/:id/like
 * Requires: User authentication (optionalAuth middleware)
 */
const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please login to like this blog.'
      });
    }

    // Check if id is a valid ObjectId or a slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    let blog;
    if (isObjectId) {
      blog = await Blog.findById(id);
    } else {
      blog = await Blog.findOne({ slug: id });
    }
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found'
      });
    }

    // Check if user already liked
    const isLiked = blog.likes && blog.likes.some(
      likeId => likeId.toString() === userId.toString()
    );

    if (isLiked) {
      // Unlike: remove user from likes array
      blog.likes = blog.likes.filter(
        likeId => likeId.toString() !== userId.toString()
      );
    } else {
      // Like: add user to likes array (prevent duplicates)
      if (!blog.likes) {
        blog.likes = [];
      }
      if (!blog.likes.some(likeId => likeId.toString() === userId.toString())) {
        blog.likes.push(userId);
      }
    }

    await blog.save();

    res.json({
      success: true,
      message: isLiked ? 'Blog unliked successfully' : 'Blog liked successfully',
      isLiked: !isLiked,
      likeCount: blog.likes.length
    });
  } catch (error) {
    console.error('Error in toggle like:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle like',
      details: error.message
    });
  }
};

/**
 * Bookmark/Unbookmark a blog
 * POST /api/blogs/:id/bookmark
 * Requires: User authentication (optionalAuth middleware)
 */
const toggleBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please login to bookmark this blog.'
      });
    }

    // Check if id is a valid ObjectId or a slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    let blog;
    if (isObjectId) {
      blog = await Blog.findById(id);
    } else {
      blog = await Blog.findOne({ slug: id });
    }
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found'
      });
    }

    // Check if user already bookmarked
    const isBookmarked = blog.bookmarks && blog.bookmarks.some(
      bookmarkId => bookmarkId.toString() === userId.toString()
    );

    if (isBookmarked) {
      // Unbookmark: remove user from bookmarks array
      blog.bookmarks = blog.bookmarks.filter(
        bookmarkId => bookmarkId.toString() !== userId.toString()
      );
    } else {
      // Bookmark: add user to bookmarks array (prevent duplicates)
      if (!blog.bookmarks) {
        blog.bookmarks = [];
      }
      if (!blog.bookmarks.some(bookmarkId => bookmarkId.toString() === userId.toString())) {
        blog.bookmarks.push(userId);
      }
    }

    await blog.save();

    res.json({
      success: true,
      message: isBookmarked ? 'Blog unbookmarked successfully' : 'Blog bookmarked successfully',
      isBookmarked: !isBookmarked,
      bookmarkCount: blog.bookmarks.length
    });
  } catch (error) {
    console.error('Error in toggle bookmark:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle bookmark',
      details: error.message
    });
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  deleteBlogImage,
  toggleLike,
  toggleBookmark
};

