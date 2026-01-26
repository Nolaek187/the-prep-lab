const express = require('express');
const router = express.Router();
const Ingredient = require('../models/Ingredient');
const { authenticateToken } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/adminAuth');

/**
 * Get all ingredients
 * GET /api/v1/ingredients
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, search, inStock } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = {};

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by stock status
    if (inStock === 'true') {
      query.quantity = { $gt: 0 };
    } else if (inStock === 'false') {
      query.quantity = { $lte: 0 };
    }

    const ingredients = await Ingredient.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Ingredient.countDocuments(query);

    res.status(200).json({
      count: ingredients.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      ingredients
    });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    next(error);
  }
});

/**
 * Get ingredient by ID
 * GET /api/v1/ingredients/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        message: 'Ingredient not found'
      });
    }

    res.status(200).json(ingredient);
  } catch (error) {
    console.error('Error fetching ingredient:', error);
    next(error);
  }
});

/**
 * Create new ingredient (admin only)
 * POST /api/v1/ingredients
 */
router.post('/', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      unit,
      quantity,
      reorderLevel,
      costPrice,
      supplier,
      expiryDate,
      batchNumber,
      storageLocation
    } = req.body;

    // Validate required fields
    if (!name || !category || !unit || quantity === undefined) {
      return res.status(400).json({
        message: 'Name, category, unit, and quantity are required'
      });
    }

    // Check if ingredient already exists
    const existingIngredient = await Ingredient.findOne({ name });
    if (existingIngredient) {
      return res.status(409).json({
        message: 'Ingredient with this name already exists'
      });
    }

    const ingredient = new Ingredient({
      name,
      description,
      category,
      unit,
      quantity,
      reorderLevel: reorderLevel || 10,
      costPrice,
      supplier,
      expiryDate,
      batchNumber,
      storageLocation,
      createdBy: req.user.userId
    });

    await ingredient.save();

    res.status(201).json({
      message: 'Ingredient created successfully',
      ingredient
    });
  } catch (error) {
    console.error('Error creating ingredient:', error);
    next(error);
  }
});

/**
 * Update ingredient (admin only)
 * PATCH /api/v1/ingredients/:id
 */
router.patch('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    console.log('Update request body:', req.body);
    console.log('Ingredient ID:', req.params.id);
    
    const {
      name,
      description,
      category,
      unit,
      quantity,
      reorderLevel,
      costPrice,
      supplier,
      expiryDate,
      batchNumber,
      storageLocation,
      allergens,
      nutritionInfo,
      isActive
    } = req.body;

    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        message: 'Ingredient not found'
      });
    }

    console.log('Found ingredient:', ingredient.name);
    console.log('Current quantity:', ingredient.quantity);
    console.log('New quantity from request:', quantity);

    // Check if new name already exists (if name is being changed)
    if (name && name !== ingredient.name) {
      const existingIngredient = await Ingredient.findOne({ name });
      if (existingIngredient) {
        return res.status(409).json({
          message: 'Ingredient with this name already exists'
        });
      }
      ingredient.name = name;
    }

    // Update fields only if they are provided
    if (description !== undefined) {
      console.log('Updating description from', ingredient.description, 'to', description);
      ingredient.description = description;
    }
    if (category) ingredient.category = category;
    if (unit) ingredient.unit = unit;
    if (reorderLevel !== undefined) ingredient.reorderLevel = reorderLevel;
    if (costPrice !== undefined) ingredient.costPrice = costPrice;
    if (supplier !== undefined) ingredient.supplier = supplier;
    if (expiryDate !== undefined) ingredient.expiryDate = expiryDate;
    if (batchNumber !== undefined) ingredient.batchNumber = batchNumber;
    if (storageLocation !== undefined) ingredient.storageLocation = storageLocation;
    if (allergens !== undefined) ingredient.allergens = allergens;
    if (nutritionInfo !== undefined) ingredient.nutritionInfo = nutritionInfo;
    if (isActive !== undefined) ingredient.isActive = isActive;

    // Handle quantity update separately with history tracking
    if (quantity !== undefined && quantity !== ingredient.quantity) {
      console.log('Quantity is being updated');
      const previousQuantity = ingredient.quantity;
      
      // Initialize quantityHistory if it doesn't exist
      if (!ingredient.quantityHistory) {
        ingredient.quantityHistory = [];
      }

      const historyEntry = {
        previousQuantity,
        newQuantity: quantity,
        type: 'set',
        reason: 'Direct update via PATCH',
        changedBy: req.user.userId,
        timestamp: new Date()
      };

      console.log('Adding history entry:', historyEntry);
      ingredient.quantityHistory.push(historyEntry);

      ingredient.quantity = quantity;
      console.log('Quantity updated to:', ingredient.quantity);
    }

    ingredient.updatedBy = req.user.userId;
    ingredient.updatedAt = new Date();

    console.log('Saving ingredient...');
    console.log('Ingredient before save:', {
      description: ingredient.description,
      quantity: ingredient.quantity,
      quantityHistoryLength: ingredient.quantityHistory?.length
    });

    const savedIngredient = await ingredient.save();

    console.log('Ingredient saved successfully');
    console.log('Ingredient after save:', {
      description: savedIngredient.description,
      quantity: savedIngredient.quantity,
      quantityHistoryLength: savedIngredient.quantityHistory?.length
    });

    res.status(200).json({
      message: 'Ingredient updated successfully',
      ingredient: savedIngredient
    });
  } catch (error) {
    console.error('Error updating ingredient:', error);
    console.error('Error stack:', error.stack);
    next(error);
  }
});

/**
 * Delete ingredient (admin only)
 * DELETE /api/v1/ingredients/:id
 */
router.delete('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const ingredient = await Ingredient.findByIdAndDelete(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        message: 'Ingredient not found'
      });
    }

    res.status(200).json({
      message: 'Ingredient deleted successfully',
      ingredient
    });
  } catch (error) {
    console.error('Error deleting ingredient:', error);
    next(error);
  }
});

/**
 * Update ingredient quantity (admin only)
 * PATCH /api/v1/ingredients/:id/quantity
 */
router.patch('/:id/quantity', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { quantity, type, reason } = req.body;

    if (quantity === undefined || !type) {
      return res.status(400).json({
        message: 'Quantity and type (add/subtract/set) are required'
      });
    }

    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        message: 'Ingredient not found'
      });
    }

    const previousQuantity = ingredient.quantity;
    let newQuantity;

    switch (type) {
      case 'add':
        newQuantity = ingredient.quantity + quantity;
        break;
      case 'subtract':
        newQuantity = ingredient.quantity - quantity;
        if (newQuantity < 0) {
          return res.status(400).json({
            message: 'Cannot subtract more than available quantity'
          });
        }
        break;
      case 'set':
        newQuantity = quantity;
        break;
      default:
        return res.status(400).json({
          message: 'Type must be add, subtract, or set'
        });
    }

    ingredient.quantity = newQuantity;
    ingredient.updatedBy = req.user.userId;
    ingredient.updatedAt = new Date();

    // Add to quantity history
    if (!ingredient.quantityHistory) {
      ingredient.quantityHistory = [];
    }

    ingredient.quantityHistory.push({
      previousQuantity,
      newQuantity,
      type,
      reason: reason || 'Manual adjustment',
      changedBy: req.user.userId,
      timestamp: new Date()
    });

    await ingredient.save();

    res.status(200).json({
      message: 'Ingredient quantity updated successfully',
      ingredient
    });
  } catch (error) {
    console.error('Error updating ingredient quantity:', error);
    next(error);
  }
});

/**
 * Get low stock ingredients (admin only)
 * GET /api/v1/ingredients/stock/low
 */
router.get('/stock/low', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const ingredients = await Ingredient.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] }
    }).sort({ quantity: 1 });

    res.status(200).json({
      count: ingredients.length,
      ingredients
    });
  } catch (error) {
    console.error('Error fetching low stock ingredients:', error);
    next(error);
  }
});

/**
 * Get expired ingredients (admin only)
 * GET /api/v1/ingredients/stock/expired
 */
router.get('/stock/expired', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const ingredients = await Ingredient.find({
      expiryDate: { $lt: now },
      quantity: { $gt: 0 }
    }).sort({ expiryDate: 1 });

    res.status(200).json({
      count: ingredients.length,
      ingredients
    });
  } catch (error) {
    console.error('Error fetching expired ingredients:', error);
    next(error);
  }
});

/**
 * Bulk update ingredient quantities (admin only)
 * PATCH /api/v1/ingredients/bulk-update
 */
router.patch('/bulk-update', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        message: 'Updates array is required and must not be empty'
      });
    }

    const results = [];

    for (const update of updates) {
      const { ingredientId, quantity, type, reason } = update;

      const ingredient = await Ingredient.findById(ingredientId);
      if (!ingredient) {
        results.push({
          ingredientId,
          success: false,
          message: 'Ingredient not found'
        });
        continue;
      }

      const previousQuantity = ingredient.quantity;
      let newQuantity;

      switch (type) {
        case 'add':
          newQuantity = ingredient.quantity + quantity;
          break;
        case 'subtract':
          newQuantity = ingredient.quantity - quantity;
          if (newQuantity < 0) {
            results.push({
              ingredientId,
              success: false,
              message: 'Cannot subtract more than available quantity'
            });
            continue;
          }
          break;
        case 'set':
          newQuantity = quantity;
          break;
        default:
          results.push({
            ingredientId,
            success: false,
            message: 'Invalid type'
          });
          continue;
      }

      ingredient.quantity = newQuantity;
      ingredient.updatedBy = req.user.userId;
      ingredient.updatedAt = new Date();

      if (!ingredient.quantityHistory) {
        ingredient.quantityHistory = [];
      }

      ingredient.quantityHistory.push({
        previousQuantity,
        newQuantity,
        type,
        reason: reason || 'Bulk update',
        changedBy: req.user.userId,
        timestamp: new Date()
      });

      await ingredient.save();

      results.push({
        ingredientId,
        success: true,
        message: 'Ingredient updated successfully',
        ingredient
      });
    }

    res.status(200).json({
      message: 'Bulk update completed',
      results
    });
  } catch (error) {
    console.error('Error bulk updating ingredients:', error);
    next(error);
  }
});

module.exports = router;