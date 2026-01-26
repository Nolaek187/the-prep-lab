const mongoose = require('mongoose');

const quantityHistorySchema = new mongoose.Schema({
  previousQuantity: { type: Number, required: true },
  newQuantity: { type: Number, required: true },
  type: { type: String, required: true, enum: ['add', 'subtract', 'set', 'initial'] },
  reason: { type: String, default: 'Manual adjustment' },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now }
});

const ingredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['starch', 'proteins', 'vegetables', 'condiments'],
    required: true
  },
  description: String,
  unit: {
    type: String,
    default: 'grams'
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  reorderLevel: {
    type: Number,
    default: 10
  },
  costPrice: Number,
  supplier: String,
  expiryDate: Date,
  batchNumber: String,
  storageLocation: String,
  allergens: [String],
  nutritionInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  quantityHistory: [quantityHistorySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual to check if ingredient is low in stock
ingredientSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.minQuantity;
});

// Method to update quantity with history tracking
ingredientSchema.methods.updateQuantity = function(newQuantity, type, reason, userId) {
  this.quantityHistory.push({
    previousQuantity: this.quantity,
    newQuantity: newQuantity,
    type: type,
    reason: reason,
    changedBy: userId,
    timestamp: new Date()
  });
  
  this.quantity = newQuantity;
  this.updatedBy = userId;
  this.updatedAt = new Date();
};

module.exports = mongoose.model('Ingredient', ingredientSchema);