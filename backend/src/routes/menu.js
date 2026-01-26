const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const Menu = require('../models/Menu');
const Meal = require('../models/Meal');
const router = express.Router();

/**
 * Get current/active menu
 * GET /api/v1/menu/current
 */
router.get('/current', authenticateToken, async (req, res, next) => {
  try {
    const menu = await Menu.findOne({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).populate('meals.mealId');

    if (!menu) {
      return res.status(404).json({ message: 'No active menu found' });
    }

    res.status(200).json(menu);
  } catch (error) {
    console.error('Error fetching current menu:', error);
    next(error);
  }
});

/**
 * Get menu by ID
 * GET /api/v1/menu/:id
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const menu = await Menu.findById(req.params.id).populate('meals.mealId');

    if (!menu) {
      return res.status(404).json({ message: 'Menu not found' });
    }

    res.status(200).json(menu);
  } catch (error) {
    console.error('Error fetching menu:', error);
    next(error);
  }
});

/**
 * Get all menus with pagination
 * GET /api/v1/menu?page=1&limit=10
 */
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const menus = await Menu.find()
      .populate('meals.mealId')
      .skip(skip)
      .limit(limit)
      .sort({ startDate: -1 });

    const total = await Menu.countDocuments();

    res.status(200).json({
      menus,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching menus:', error);
    next(error);
  }
});

/**
 * Create new menu (admin only)
 * POST /api/v1/menu
 */
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { weekNumber, year, deliveryDays, meals, startDate, endDate, orderDeadline } = req.body;

    // Validate required fields
    if (!weekNumber || !year || !deliveryDays || !meals || !startDate || !endDate || !orderDeadline) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate delivery days
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!Array.isArray(deliveryDays) || !deliveryDays.every(day => validDays.includes(day))) {
      return res.status(400).json({ message: 'Invalid delivery days' });
    }

    // Validate meal IDs exist
    for (const meal of meals) {
      const mealExists = await Meal.findById(meal.mealId);
      if (!mealExists) {
        return res.status(404).json({ message: `Meal with ID ${meal.mealId} not found` });
      }
    }

    const menu = new Menu({
      weekNumber,
      year,
      deliveryDays,
      meals,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      orderDeadline: new Date(orderDeadline)
    });

    await menu.save();
    await menu.populate('meals.mealId');

    res.status(201).json({
      message: 'Menu created successfully',
      menu
    });
  } catch (error) {
    console.error('Error creating menu:', error);
    next(error);
  }
});

/**
 * Update menu (admin only)
 * PATCH /api/v1/menu/:id
 */
router.patch('/:id', authenticateToken, authorizeRole('admin'), async (req, res, next) => {
  try {
    const { weekNumber, year, deliveryDays, meals, startDate, endDate, orderDeadline, isActive } = req.body;

    const menu = await Menu.findById(req.params.id);

    if (!menu) {
      return res.status(404).json({ message: 'Menu not found' });
    }

    // Validate delivery days if provided
    if (deliveryDays) {
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!Array.isArray(deliveryDays) || !deliveryDays.every(day => validDays.includes(day))) {
        return res.status(400).json({ message: 'Invalid delivery days' });
      }
    }

    // Validate meal IDs if provided
    if (meals) {
      for (const meal of meals) {
        const mealExists = await Meal.findById(meal.mealId);
        if (!mealExists) {
          return res.status(404).json({ message: `Meal with ID ${meal.mealId} not found` });
        }
      }
    }

    // Update fields
    if (weekNumber !== undefined) menu.weekNumber = weekNumber;
    if (year !== undefined) menu.year = year;
    if (deliveryDays) menu.deliveryDays = deliveryDays;
    if (meals) menu.meals = meals;
    if (startDate) menu.startDate = new Date(startDate);
    if (endDate) menu.endDate = new Date(endDate);
    if (orderDeadline) menu.orderDeadline = new Date(orderDeadline);
    if (isActive !== undefined) menu.isActive = isActive;

    menu.updatedAt = new Date();
    await menu.save();
    await menu.populate('meals.mealId');

    res.status(200).json({
      message: 'Menu updated successfully',
      menu
    });
  } catch (error) {
    console.error('Error updating menu:', error);
    next(error);
  }
});

/**
 * Delete menu (admin only)
 * DELETE /api/v1/menu/:id
 */
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res, next) => {
  try {
    const menu = await Menu.findByIdAndDelete(req.params.id);

    if (!menu) {
      return res.status(404).json({ message: 'Menu not found' });
    }

    res.status(200).json({
      message: 'Menu deleted successfully',
      menu
    });
  } catch (error) {
    console.error('Error deleting menu:', error);
    next(error);
  }
});

/**
 * Deactivate menu (admin only)
 * PATCH /api/v1/menu/:id/deactivate
 */
router.patch('/:id/deactivate', authenticateToken, authorizeRole('admin'), async (req, res, next) => {
  try {
    const menu = await Menu.findById(req.params.id);

    if (!menu) {
      return res.status(404).json({ message: 'Menu not found' });
    }

    menu.isActive = false;
    menu.updatedAt = new Date();
    await menu.save();

    res.status(200).json({
      message: 'Menu deactivated successfully',
      menu
    });
  } catch (error) {
    console.error('Error deactivating menu:', error);
    next(error);
  }
});

module.exports = router;