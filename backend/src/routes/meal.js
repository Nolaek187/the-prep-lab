const express = require('express');
const router = express.Router();
const Meal = require('../models/Meal');
const { authenticateToken } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/adminAuth');

/**
 * Get all meals with pagination and filters
 * GET /api/v1/meals
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, category, isActive } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Fix: Change 'components' to 'ingredients' to match your schema
    const meals = await Meal.find(query)
      .populate('ingredients.ingredient', 'name unit category') // Changed from 'components'
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Meal.countDocuments(query);

    res.json({
      meals,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single meal by ID
 * GET /api/v1/meals/:id
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const meal = await Meal.findById(req.params.id)
      .populate('ingredients.ingredient', 'name unit category costPrice') // Changed from 'components'
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!meal) {
      return res.status(404).json({
        message: 'Meal not found'
      });
    }

    res.json({
      meal
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create new meal (admin only)
 * POST /api/v1/meals
 */
router.post('/', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      category,
      ingredients,
      preparationTime,
      servingSize,
      imageUrl,
      isAvailable,
      nutritionInfo,
      allergens
    } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        message: 'Missing required fields: name, description, price, and category are required'
      });
    }

    // Check if meal with same name already exists
    const existingMeal = await Meal.findOne({ name });
    if (existingMeal) {
      return res.status(409).json({
        message: 'Meal with this name already exists'
      });
    }

    const meal = new Meal({
      name,
      description,
      price,
      category,
      ingredients: ingredients || [],
      preparationTime,
      servingSize,
      imageUrl,
      isAvailable,
      nutritionInfo,
      allergens,
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await meal.save();

    // Populate ingredients after saving
    await meal.populate('ingredients.ingredient', 'name unit category');

    res.status(201).json({
      message: 'Meal created successfully',
      meal
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update meal (admin only)
 * PATCH /api/v1/meals/:id
 */
router.patch('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      category,
      ingredients,
      preparationTime,
      servingSize,
      imageUrl,
      isAvailable,
      isActive,
      nutritionInfo,
      allergens
    } = req.body;

    const meal = await Meal.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({
        message: 'Meal not found'
      });
    }

    // Check if new name already exists (if name is being changed)
    if (name && name !== meal.name) {
      const existingMeal = await Meal.findOne({ name });
      if (existingMeal) {
        return res.status(409).json({
          message: 'Meal with this name already exists'
        });
      }
      meal.name = name;
    }

    // Update fields only if they are provided
    if (description !== undefined) meal.description = description;
    if (price !== undefined) meal.price = price;
    if (category !== undefined) meal.category = category;
    if (ingredients !== undefined) meal.ingredients = ingredients;
    if (preparationTime !== undefined) meal.preparationTime = preparationTime;
    if (servingSize !== undefined) meal.servingSize = servingSize;
    if (imageUrl !== undefined) meal.imageUrl = imageUrl;
    if (isAvailable !== undefined) meal.isAvailable = isAvailable;
    if (isActive !== undefined) meal.isActive = isActive;
    if (nutritionInfo !== undefined) meal.nutritionInfo = nutritionInfo;
    if (allergens !== undefined) meal.allergens = allergens;

    meal.updatedBy = req.user.userId;
    meal.updatedAt = new Date();

    await meal.save();

    // Populate ingredients after saving
    await meal.populate('ingredients.ingredient', 'name unit category');

    res.status(200).json({
      message: 'Meal updated successfully',
      meal
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete/Deactivate meal (admin only)
 * DELETE /api/v1/meals/:id
 */
router.delete('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const meal = await Meal.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({
        message: 'Meal not found'
      });
    }

    // Soft delete by setting isActive to false
    meal.isActive = false;
    meal.updatedBy = req.user.userId;
    await meal.save();

    res.status(200).json({
      message: 'Meal deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Check ingredient availability for a meal
 * GET /api/v1/meals/:id/availability
 */
router.get('/:id/availability', authenticateToken, async (req, res, next) => {
  try {
    const { servings = 1 } = req.query;
    const meal = await Meal.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({
        message: 'Meal not found'
      });
    }

    const isAvailable = await meal.checkIngredientAvailability(parseInt(servings));
    const requirements = await meal.getIngredientRequirements(parseInt(servings));

    res.json({
      mealId: meal._id,
      mealName: meal.name,
      servings: parseInt(servings),
      isAvailable,
      requirements
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Calculate meal cost
 * GET /api/v1/meals/:id/cost
 */
router.get('/:id/cost', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const meal = await Meal.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({
        message: 'Meal not found'
      });
    }

    const cost = await meal.calculateCost();
    const profit = meal.price - cost;
    const profitMargin = ((profit / meal.price) * 100).toFixed(2);

    res.json({
      mealId: meal._id,
      mealName: meal.name,
      cost: cost.toFixed(2),
      price: meal.price.toFixed(2),
      profit: profit.toFixed(2),
      profitMargin: `${profitMargin}%`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;