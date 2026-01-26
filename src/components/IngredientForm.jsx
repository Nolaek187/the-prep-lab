import React, { useState, useEffect } from 'react';
import { ingredientsAPI } from '../services/api';

const IngredientForm = ({ ingredient, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'vegetables',
    quantity: 0,
    unit: 'kg',
    reorderLevel: 0,
    costPrice: 0,
    supplier: '',
    expiryDate: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ingredient) {
      setFormData({
        name: ingredient.name || '',
        category: ingredient.category || 'vegetables',
        quantity: ingredient.quantity || 0,
        unit: ingredient.unit || 'kg',
        reorderLevel: ingredient.reorderLevel || 0,
        costPrice: ingredient.costPrice || 0,
        supplier: ingredient.supplier || '',
        expiryDate: ingredient.expiryDate 
          ? new Date(ingredient.expiryDate).toISOString().split('T')[0] 
          : '',
      });
    }
  }, [ingredient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const submitData = {
        ...formData,
        quantity: parseFloat(formData.quantity),
        reorderLevel: parseFloat(formData.reorderLevel),
        costPrice: parseFloat(formData.costPrice),
        expiryDate: formData.expiryDate || undefined,
      };

      if (ingredient) {
        await ingredientsAPI.update(ingredient._id, submitData);
      } else {
        await ingredientsAPI.create(submitData);
      }
      onSave();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to save ingredient';
      setError(errorMessage);
      console.error('Error saving ingredient:', err);
    }
  };

  return (
    <div className="ingredient-form-container">
      <form onSubmit={handleSubmit} className="ingredient-form">
        <h2>{ingredient ? 'Edit Ingredient' : 'Create New Ingredient'}</h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="name">Ingredient Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter ingredient name"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="starch">Starch</option>
              <option value="proteins">Proteins</option>
              <option value="vegetables">Vegetables</option>
              <option value="condiments">Condiments</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="unit">Unit *</label>
            <select
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              required
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="g">Grams (g)</option>
              <option value="l">Liters (l)</option>
              <option value="ml">Milliliters (ml)</option>
              <option value="pcs">Pieces (pcs)</option>
              <option value="lbs">Pounds (lbs)</option>
              <option value="oz">Ounces (oz)</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="quantity">Quantity *</label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reorderLevel">Reorder Level *</label>
            <input
              type="number"
              id="reorderLevel"
              name="reorderLevel"
              value={formData.reorderLevel}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label htmlFor="costPrice">Cost Price ($) *</label>
            <input
              type="number"
              id="costPrice"
              name="costPrice"
              value={formData.costPrice}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="supplier">Supplier</label>
            <input
              type="text"
              id="supplier"
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              placeholder="Enter supplier name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="expiryDate">Expiry Date</label>
            <input
              type="date"
              id="expiryDate"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {ingredient ? 'Update Ingredient' : 'Create Ingredient'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default IngredientForm;