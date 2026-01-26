const Meal = require('../models/Meal');
const Ingredient = require('../models/Ingredient');
const mongoose = require('mongoose');

/**
 * Check if meals can be prepared with current inventory
 */
const checkMealAvailability = async (orderItems) => {
  const availabilityStatus = [];

  for (const item of orderItems) {
    const meal = await Meal.findById(item.mealId).populate('ingredients.ingredient');

    if (!meal) {
      availabilityStatus.push({
        mealId: item.mealId,
        available: false,
        reason: 'Meal not found'
      });
      continue;
    }

    const requirements = await meal.getIngredientRequirements(item.quantity);
    const missingIngredients = requirements.filter(r => !r.available);

    availabilityStatus.push({
      mealId: item.mealId,
      mealName: meal.name,
      quantity: item.quantity,
      available: missingIngredients.length === 0,
      requirements,
      missingIngredients
    });
  }

  return availabilityStatus;
};

/**
 * Process order and update ingredient quantities
 */
const processOrderInventory = async (orderItems, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // First, check availability
    const availability = await checkMealAvailability(orderItems);
    const unavailableMeals = availability.filter(a => !a.available);

    if (unavailableMeals.length > 0) {
      await session.abortTransaction();
      return {
        success: false,
        message: 'Some meals cannot be prepared due to insufficient ingredients',
        unavailableMeals
      };
    }

    const inventoryUpdates = [];

    // Process each order item
    for (const item of orderItems) {
      const meal = await Meal.findById(item.mealId)
        .populate('ingredients.ingredient')
        .session(session);

      // Update each ingredient
      for (const portion of meal.ingredients) {
        const ingredient = await Ingredient.findById(portion.ingredient._id).session(session);
        const requiredQuantity = portion.quantity * item.quantity;
        const newQuantity = ingredient.quantity - requiredQuantity;

        // Use the updateQuantity method to track history
        ingredient.updateQuantity(
          newQuantity,
          'subtract',
          `Order - ${meal.name} (${item.quantity}x)`,
          userId
        );

        await ingredient.save({ session });

        inventoryUpdates.push({
          ingredientId: ingredient._id,
          ingredientName: ingredient.name,
          previousQuantity: ingredient.quantityHistory[ingredient.quantityHistory.length - 1].previousQuantity,
          newQuantity: newQuantity,
          quantityUsed: requiredQuantity,
          unit: portion.unit
        });
      }
    }

    await session.commitTransaction();

    return {
      success: true,
      message: 'Inventory updated successfully',
      inventoryUpdates
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get ingredient requirements for a specific meal
 */
const getMealIngredientRequirements = async (mealId, quantity = 1) => {
  const meal = await Meal.findById(mealId).populate('ingredients.ingredient');

  if (!meal) {
    throw new Error('Meal not found');
  }

  const requirements = await meal.getIngredientRequirements(quantity);
  const canPrepare = requirements.every(r => r.available);

  return {
    mealId: meal._id,
    mealName: meal.name,
    servings: quantity,
    canPrepare,
    requirements
  };
};

module.exports = {
  checkMealAvailability,
  processOrderInventory,
  getMealIngredientRequirements
};