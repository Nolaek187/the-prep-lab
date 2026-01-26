const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const FoodOrder = require('../models/FoodOrder');
const User = require('../models/User');
const Meal = require('../models/Meal');
const { authenticateToken } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/adminAuth');



/**
 * Create a new user
 * POST /api/v1/admin/users
 */
router.post('/users',  authenticateToken, verifyAdmin,async (req, res, next) => {
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
      password, // The pre-save hook in User.js will hash this
      role: role || 'customer',
      name,
      phone
    });

    await user.save();

    // Don't send the password back
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
 * Get user by ID
 * GET /api/v1/admin/users/:id
 */
router.get('/users/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
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
 * Update a user
 * PUT /api/v1/admin/users/:id
 */
router.put('/users/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { name, email, phone, role, isActive, username } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from changing their own role or deactivating themselves
    if (user._id.equals(req.user.id)) {
      if (role && role !== 'admin') {
        return res.status(400).json({ message: 'Admins cannot change their own role.' });
      }
      if (isActive === false || isActive === 'false') {
        return res.status(400).json({ message: 'Admins cannot deactivate their own account.' });
      }
    }

    // Update fields
    user.name = name || user.name;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.role = role || user.role;
    user.username = username || user.username;
    if (isActive !== undefined) {
      user.isActive = isActive;
    }
    user.updatedAt = Date.now();

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
 * Delete a user
 * DELETE /api/v1/admin/users/:id
 */
router.delete('/users/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
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