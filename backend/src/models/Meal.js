const mongoose = require('mongoose');

const ingredientPortionSchema = new mongoose.Schema({
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    default: 'grams'
  }
});

const mealSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'],
    required: true
  },
  ingredients: [ingredientPortionSchema],
  preparationTime: {
    type: Number,
    default: 0
  },
  servingSize: {
    type: Number,
    default: 1
  },
  imageUrl: String,
  isAvailable: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  nutritionInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  },
  allergens: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Method to check if meal can be prepared
mealSchema.methods.checkIngredientAvailability = async function(servings = 1) {
  const Ingredient = mongoose.model('Ingredient');
  
  for (const portion of this.ingredients) {
    const ingredient = await Ingredient.findById(portion.ingredient);
    const requiredQuantity = portion.quantity * servings;
    
    if (!ingredient || ingredient.quantity < requiredQuantity) {
      return false;
    }
  }
  return true;
};

// Method to get ingredient requirements
mealSchema.methods.getIngredientRequirements = async function(servings = 1) {
  const Ingredient = mongoose.model('Ingredient');
  const requirements = [];
  
  for (const portion of this.ingredients) {
    const ingredient = await Ingredient.findById(portion.ingredient);
    const requiredQuantity = portion.quantity * servings;
    
    requirements.push({
      ingredient: {
        id: ingredient._id,
        name: ingredient.name,
        currentStock: ingredient.quantity,
        unit: ingredient.unit
      },
      requiredPerServing: portion.quantity,
      totalRequired: requiredQuantity,
      available: ingredient.quantity >= requiredQuantity,
      shortage: Math.max(0, requiredQuantity - ingredient.quantity)
    });
  }
  
  return requirements;
};

// Method to calculate cost
mealSchema.methods.calculateCost = async function() {
  const Ingredient = mongoose.model('Ingredient');
  let totalCost = 0;
  
  for (const portion of this.ingredients) {
    const ingredient = await Ingredient.findById(portion.ingredient);
    if (ingredient && ingredient.costPrice) {
      const costPerUnit = ingredient.costPrice / ingredient.quantity;
      totalCost += costPerUnit * portion.quantity;
    }
  }
  
  return totalCost;
};

module.exports = mongoose.model('Meal', mealSchema);
