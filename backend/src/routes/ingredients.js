const express = require('express');
const router = express.Router();
const Ingredient = require('../models/Ingredient');
const { authenticateToken } = require('../middleware/auth');
const { verifyAdmin } = require('../middleware/adminAuth');


/**
 * Get ingredient statistics
 * GET /api/v1/ingredients/stats
 */
router.get('/stats', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const totalIngredients = await Ingredient.countDocuments({ isActive: true });
    const lowStockCount = await Ingredient.countDocuments({
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
      isActive: true
    });
    const outOfStockCount = await Ingredient.countDocuments({
      quantity: { $lte: 0 },
      isActive: true
    });

    const categoryStats = await Ingredient.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
          avgCostPrice: { $avg: '$costPrice' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalInventoryValue = await Ingredient.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantity', '$costPrice'] } }
        }
      }
    ]);

    res.status(200).json({
      totalIngredients,
      lowStockCount,
      outOfStockCount,
      totalInventoryValue: totalInventoryValue[0]?.totalValue || 0,
      categoryStats
    });
  } catch (error) {
    console.error('Error fetching ingredient statistics:', error);
    next(error);
  }
});

/**
 * Get low stock ingredients
 * GET /api/v1/ingredients/stock/low
 */
router.get('/stock/low', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const ingredients = await Ingredient.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
      isActive: true
    })
    .populate('createdBy', 'name email')
    .sort({ quantity: 1 });

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
 * Get expired ingredients
 * GET /api/v1/ingredients/stock/expired
 */
router.get('/stock/expired', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const ingredients = await Ingredient.find({
      expiryDate: { $lte: now },
      isActive: true
    })
    .populate('createdBy', 'name email')
    .sort({ expiryDate: 1 });

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
 * Get ingredients expiring soon
 * GET /api/v1/ingredients/stock/expiring-soon
 */
router.get('/stock/expiring-soon', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const ingredients = await Ingredient.find({
      expiryDate: {
        $gte: now,
        $lte: futureDate
      },
      isActive: true,
      quantity: { $gt: 0 }
    })
    .populate('createdBy', 'name email')
    .sort({ expiryDate: 1 });

    res.status(200).json({
      count: ingredients.length,
      daysAhead: parseInt(days),
      ingredients
    });
  } catch (error) {
    console.error('Error fetching expiring ingredients:', error);
    next(error);
  }
});


/**
 * Search ingredients
 * GET /api/v1/ingredients/search
 */
router.get('/search', authenticateToken, async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        message: 'Search query is required'
      });
    }

    const ingredients = await Ingredient.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { supplier: { $regex: q, $options: 'i' } }
      ],
      isActive: true
    })
    .limit(parseInt(limit))
    .select('name category quantity unit reorderLevel')
    .sort({ name: 1 });

    res.status(200).json({
      query: q,
      count: ingredients.length,
      ingredients
    });
  } catch (error) {
    console.error('Error searching ingredients:', error);
    next(error);
  }
});



/**
 * Bulk update ingredient quantities
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
    const validTypes = ['add', 'subtract', 'adjust', 'restock'];

    for (const update of updates) {
      const { ingredientId, quantity, type, reason } = update;

      // Validate each update
      if (!ingredientId || quantity === undefined || !type || !reason) {
        results.push({
          ingredientId,
          success: false,
          message: 'Missing required fields: ingredientId, quantity, type, or reason'
        });
        continue;
      }

      if (!validTypes.includes(type)) {
        results.push({
          ingredientId,
          success: false,
          message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
        });
        continue;
      }

      const parsedQuantity = parseFloat(quantity);
      if (parsedQuantity < 0) {
        results.push({
          ingredientId,
          success: false,
          message: 'Quantity cannot be negative'
        });
        continue;
      }

      try {
        const ingredient = await Ingredient.findById(ingredientId);

        if (!ingredient) {
          results.push({
            ingredientId,
            success: false,
            message: 'Ingredient not found'
          });
          continue;
        }

        // Use the updateQuantity method from the model
        await ingredient.updateQuantity(parsedQuantity, type, reason, req.user.userId);

        results.push({
          ingredientId,
          success: true,
          message: 'Ingredient updated successfully',
          ingredient
        });
      } catch (error) {
        results.push({
          ingredientId,
          success: false,
          message: error.message || 'Error updating ingredient'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.status(200).json({
      message: `Bulk update completed: ${successCount} succeeded, ${failureCount} failed`,
      successCount,
      failureCount,
      results
    });
  } catch (error) {
    console.error('Error bulk updating ingredients:', error);
    next(error);
  }
});


/**
 * Get ingredients by category
 * GET /api/v1/ingredients/category/:category
 */
router.get('/category/:category', authenticateToken, async (req, res, next) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const validCategories = ['starch', 'proteins', 'vegetables', 'condiments'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const ingredients = await Ingredient.find({
      category,
      isActive: true
    })
    .populate('createdBy', 'name email')
    .limit(parseInt(limit))
    .skip(skip)
    .sort({ name: 1 });

    const total = await Ingredient.countDocuments({
      category,
      isActive: true
    });

    res.status(200).json({
      category,
      count: ingredients.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      ingredients
    });
  } catch (error) {
    console.error('Error fetching ingredients by category:', error);
    next(error);
  }
});

/**
 * Get all ingredients with filtering and pagination
 * GET /api/v1/ingredients
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      search,
      inStock,
      sortBy = 'name',
      sortOrder = 1 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sortBy]: parseInt(sortOrder) };

    let query = { isActive: true };
    
    // Category filter
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

    // Stock filter
    if (inStock === 'true') {
      query.quantity = { $gt: 0 };
    } else if (inStock === 'false') {
      query.quantity = { $lte: 0 };
    }

    const ingredients = await Ingredient.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .limit(parseInt(limit))
      .skip(skip)
      .sort(sortObj);

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
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('quantityHistory.changedBy', 'name email');

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
 * Create new ingredient
 * POST /api/v1/ingredients
 */
router.post('/', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const {
      name,
      category,
      description,
      unit,
      quantity,
      reorderLevel,
      costPrice,
      supplier,
      expiryDate,
      batchNumber,
      storageLocation
    } = req.body;

    // Validation
    if (!name || !category || !unit || quantity === undefined) {
      return res.status(400).json({
        message: 'Name, category, unit, and quantity are required'
      });
    }

    const validCategories = ['starch', 'proteins', 'vegetables', 'condiments'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // Check if ingredient already exists
    const existingIngredient = await Ingredient.findOne({ 
      name: name.trim(),
      isActive: true 
    });

    if (existingIngredient) {
      return res.status(409).json({
        message: 'Ingredient with this name already exists'
      });
    }

    const ingredient = new Ingredient({
      name: name.trim(),
      category,
      description,
      unit,
      quantity: parseFloat(quantity),
      reorderLevel: reorderLevel ? parseFloat(reorderLevel) : 10,
      costPrice: costPrice ? parseFloat(costPrice) : 0,
      supplier,
      expiryDate,
      batchNumber,
      storageLocation,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
      quantityHistory: [{
        previousQuantity: 0,
        newQuantity: parseFloat(quantity),
        type: 'add',
        reason: 'Initial stock',
        changedBy: req.user.userId,
        timestamp: new Date()
      }]
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
 * Update ingredient
 * PATCH /api/v1/ingredients/:id
 */
router.patch('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const {
      name,
      category,
      description,
      unit,
      reorderLevel,
      costPrice,
      supplier,
      expiryDate,
      batchNumber,
      storageLocation,
      isActive
    } = req.body;

    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        message: 'Ingredient not found'
      });
    }

    // Update fields
    if (name) ingredient.name = name.trim();
    if (category) {
      const validCategories = ['starch', 'proteins', 'vegetables', 'condiments'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        });
      }
      ingredient.category = category;
    }
    if (description !== undefined) ingredient.description = description;
    if (unit) ingredient.unit = unit;
    if (reorderLevel !== undefined) ingredient.reorderLevel = parseFloat(reorderLevel);
    if (costPrice !== undefined) ingredient.costPrice = parseFloat(costPrice);
    if (supplier !== undefined) ingredient.supplier = supplier;
    if (expiryDate !== undefined) ingredient.expiryDate = expiryDate;
    if (batchNumber !== undefined) ingredient.batchNumber = batchNumber;
    if (storageLocation !== undefined) ingredient.storageLocation = storageLocation;
    if (isActive !== undefined) ingredient.isActive = isActive;

    ingredient.updatedBy = req.user.userId;

    await ingredient.save();

    res.status(200).json({
      message: 'Ingredient updated successfully',
      ingredient
    });
  } catch (error) {
    console.error('Error updating ingredient:', error);
    next(error);
  }
});

/**
 * Update ingredient quantity
 * PATCH /api/v1/ingredients/:id/quantity
 */
router.patch('/:id/quantity', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { quantity, type, reason } = req.body;

    if (quantity === undefined || !type || !reason) {
      return res.status(400).json({
        message: 'Quantity, type, and reason are required'
      });
    }

    const validTypes = ['add', 'subtract', 'adjust', 'restock'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const parsedQuantity = parseFloat(quantity);
    if (parsedQuantity < 0) {
      return res.status(400).json({
        message: 'Quantity cannot be negative'
      });
    }

    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        message: 'Ingredient not found'
      });
    }

    // Use the updateQuantity method from the model
    await ingredient.updateQuantity(parsedQuantity, type, reason, req.user.userId);

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
 * Delete ingredient (soft delete)
 * DELETE /api/v1/ingredients/:id
 */
router.delete('/:id', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({
        message: 'Ingredient not found'
      });
    }

    // Soft delete by setting isActive to false
    ingredient.isActive = false;
    ingredient.updatedBy = req.user.userId;
    await ingredient.save();

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
 * Get ingredient quantity history
 * GET /api/v1/ingredients/:id/history
 */
router.get('/:id/history', authenticateToken, verifyAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const ingredient = await Ingredient.findById(req.params.id)
      .populate('quantityHistory.changedBy', 'name email')
      .select('name quantityHistory');

    if (!ingredient) {
      return res.status(404).json({
        message: 'Ingredient not found'
      });
    }

    // Sort history by timestamp descending and paginate
    const history = ingredient.quantityHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(skip, skip + parseInt(limit));

    const total = ingredient.quantityHistory.length;

    res.status(200).json({
      ingredientName: ingredient.name,
      count: history.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      history
    });
  } catch (error) {
    console.error('Error fetching ingredient history:', error);
    next(error);
  }
});








module.exports = router;