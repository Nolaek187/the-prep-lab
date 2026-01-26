const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/adminAuth');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

/**
 * Get all users (admin only)
 * GET /api/v1/users
 */
router.get('/', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = {};

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by role
    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-password')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    next(error);
  }
});

/**
 * Get user by ID (admin only)
 * GET /api/v1/users/:id
 */
router.get('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    next(error);
  }
});

/**
 * Create a new user (admin only)
 * POST /api/v1/users
 */
router.post('/', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { username, email, password, role, name, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email or username already exists' });
    }

    const user = new User({
      username,
      email,
      password,
      role: role || 'customer',
      name,
      phone
    });

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating user:', error);
    next(error);
  }
});

/**
 * Update a user (admin only)
 * PATCH /api/v1/users/:id
 */
router.patch('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { name, email, phone, role, isActive, username } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from changing their own role or deactivating themselves
    if (user._id.equals(req.user.userId)) {
      if (role && role !== 'admin') {
        return res.status(400).json({ message: 'Admins cannot change their own role.' });
      }
      if (isActive === false || isActive === 'false') {
        return res.status(400).json({ message: 'Admins cannot deactivate their own account.' });
      }
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (username) user.username = username;
    if (isActive !== undefined) user.isActive = isActive;
    user.updatedAt = new Date();

    const updatedUser = await user.save();

    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.status(200).json({
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error updating user:', error);
    next(error);
  }
});

/**
 * Delete a user (admin only)
 * DELETE /api/v1/users/:id
 */
router.delete('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from deleting their own account
    if (user._id.equals(req.user.userId)) {
      return res.status(400).json({ message: 'Admins cannot delete their own account.' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    next(error);
  }
});

module.exports = router;