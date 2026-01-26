const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const Meal = require('../models/Meal');
const Ingredient = require('../models/Ingredient');
const router = express.Router();

/**
 * Get all meals
 * GET /api/v1/meals
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const meals = await Meal.find({ isActive: true })
      .populate('components')
      .skip(skip)
      .limit(limit);

    const total = await Meal.countDocuments({ isActive: true });

    res.status(200).json({
      meals,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching meals:', error);
    next(error); // Pass the error to error handling middleware
  }
});

/**
 * Get meal by ID
 * GET /api/v1/meals/:id
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const meal = await Meal.findById(req.params.id)
      .populate('components');

    if (!meal) {
      return res.status(404).json({ message: 'Meal not found' });
    }

    res.status(200).json(meal);
  } catch (error) {
    console.error('Error fetching meal:', error);
    next(error);
  }
});

/**
 * Create new meal (admin only)
 * POST /api/v1/meals
 */
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res, next) => {
  try {
    const {
      name,
      description,
      components,
      portionSize,
      price,
      allergens,
      preparationTime,
    } = req.body;

    // Validate required fields
    if (!name || !components || !Array.isArray(components) || components.length === 0 || !price) {
      return res.status(400).json({ message: 'Missing required fields. Name, price, and at least one component are required.' });
    }

    // Validate ingredients exist
    const ingredients = await Ingredient.find({ '_id': { $in: components } });
    if (ingredients.length !== components.length) {
        return res.status(404).json({ message: 'One or more ingredients not found' });
    }

    // Calculate nutrition info
    const nutritionInfo = calculateNutritionInfo(ingredients);

    // Combine allergens
    const combinedAllergens = [
      ...new Set([
        ...ingredients.flatMap(i => i.allergens || []),
        ...(allergens || []),
      ]),
    ];

    const meal = new Meal({
      name,
      description,
      components,
      portionSize: portionSize || 1,
      price,
      allergens: combinedAllergens,
      preparationTime: preparationTime || 30,
      nutritionInfo,
    });

    await meal.save();
    await meal.populate('components');

    res.status(201).json(meal); // Return the created meal
  } catch (error) {
    console.error('Error creating meal:', error);
    next(error);
  }
});

/**
 * Update a meal (admin only)
 * PUT /api/v1/meals/:id
 */
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res, next) => {
  try {
    const mealId = req.params.id;
    const updatedData = req.body;

    const meal = await Meal.findById(mealId);

    if (!meal) {
      return res.status(404).json({ message: 'Meal not found' });
    }

    // If components are being updated, we need to re-validate and recalculate
    if (updatedData.components) {
      if (!Array.isArray(updatedData.components) || updatedData.components.length === 0) {
        return res.status(400).json({ message: 'Components must be a non-empty array.' });
      }
      
      const ingredients = await Ingredient.find({ '_id': { $in: updatedData.components } });
      if (ingredients.length !== updatedData.components.length) {
          return res.status(404).json({ message: 'One or more ingredients not found during update' });
      }

      // Recalculate nutrition info
      meal.nutritionInfo = calculateNutritionInfo(ingredients);

      // Re-combine allergens
      meal.allergens = [
        ...new Set([
          ...ingredients.flatMap(i => i.allergens || []),
          ...(updatedData.allergens || meal.allergens || []),
        ]),
      ];
    }

    // Update other fields
    meal.name = updatedData.name || meal.name;
    meal.description = updatedData.description || meal.description;
    meal.components = updatedData.components || meal.components;
    meal.portionSize = updatedData.portionSize || meal.portionSize;
    meal.price = updatedData.price || meal.price;
    meal.preparationTime = updatedData.preparationTime || meal.preparationTime;
    if (updatedData.isActive !== undefined) {
      meal.isActive = updatedData.isActive;
    }

    const updatedMeal = await meal.save();

    await updatedMeal.populate('components');

    res.status(200).json(updatedMeal);

  } catch (error) {
    console.error('Error updating meal:', error);
    next(error);
  }
});

/**
 * Deactivate a meal (admin only) - Soft Delete
 * DELETE /api/v1/meals/:id
 */
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res, next) => {
  try {
    const meal = await Meal.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({ message: 'Meal not found' });
    }

    // Instead of deleting, we'll deactivate it to maintain data integrity
    meal.isActive = false;
    await meal.save();

    res.status(200).json({ message: 'Meal deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating meal:', error);
    next(error);
  }
});


// Helper function to calculate nutrition info from an array of ingredients
function calculateNutritionInfo(ingredients) {
  return ingredients.reduce((acc, ingredient) => {
    const quantity = ingredient.quantity || 1; // Default to 1 if not specified
    acc.calories += (ingredient.nutritionInfo.calories || 0) * quantity;
    acc.protein += (ingredient.nutritionInfo.protein || 0) * quantity;
    acc.carbs += (ingredient.nutritionInfo.carbs || 0) * quantity;
    acc.fat += (ingredient.nutritionInfo.fat || 0) * quantity;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

module.exports = router;