import React, { useState, useEffect } from 'react';
import { mealsAPI, ingredientsAPI } from '../services/api';

const MealForm = ({ meal, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    portionSize: 1,
    preparationTime: 30,
    components: [], // Changed to array
    allergens: [],
  });
  const [ingredients, setIngredients] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        setLoading(true);
        // Fetch all ingredients without pagination
        const response = await ingredientsAPI.getAll(1, 1000);
        setIngredients(response.data.ingredients);
        setError(null);
      } catch (err) {
        setError('Failed to fetch ingredients');
        console.error('Error fetching ingredients:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchIngredients();
  }, []);

  useEffect(() => {
    if (meal) {
      setFormData({
        name: meal.name || '',
        description: meal.description || '',
        price: meal.price || 0,
        portionSize: meal.portionSize || 1,
        preparationTime: meal.preparationTime || 30,
        components: meal.components?.map(c => c._id || c) || [],
        allergens: meal.allergens || [],
      });
      setSelectedIngredients(meal.components?.map(c => c._id || c) || []);
    }
  }, [meal]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleIngredientToggle = (ingredientId) => {
    setSelectedIngredients(prev => {
      const newSelection = prev.includes(ingredientId)
        ? prev.filter(id => id !== ingredientId)
        : [...prev, ingredientId];
      
      setFormData({ ...formData, components: newSelection });
      return newSelection;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedIngredients.length === 0) {
      setError('Please select at least one ingredient');
      return;
    }

    try {
      const submitData = {
        ...formData,
        components: selectedIngredients,
        price: parseFloat(formData.price),
        portionSize: parseFloat(formData.portionSize),
        preparationTime: parseInt(formData.preparationTime),
      };

      if (meal) {
        await mealsAPI.update(meal._id, submitData);
      } else {
        await mealsAPI.create(submitData);
      }
      onSave();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to save meal';
      setError(errorMessage);
      console.error('Error saving meal:', err);
    }
  };

  if (loading) return <div className="form-loading">Loading ingredients...</div>;

  return (
    <div className="meal-form-container">
      <form onSubmit={handleSubmit} className="meal-form">
        <h2>{meal ? 'Edit Meal' : 'Create New Meal'}</h2>
        
        {error && (
          <div className="error-message" style={{ color: 'red', padding: '10px', marginBottom: '15px', backgroundColor: '#fee', borderRadius: '4px' }}>
            {error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="name">Meal Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter meal name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter meal description"
            rows="3"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="price">Price ($) *</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label htmlFor="portionSize">Portion Size</label>
            <input
              type="number"
              id="portionSize"
              name="portionSize"
              value={formData.portionSize}
              onChange={handleChange}
              min="1"
              step="1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="preparationTime">Prep Time (min)</label>
            <input
              type="number"
              id="preparationTime"
              name="preparationTime"
              value={formData.preparationTime}
              onChange={handleChange}
              min="1"
              step="1"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Select Ingredients * ({selectedIngredients.length} selected)</label>
          <div className="ingredients-list" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}>
            {ingredients.map((ingredient) => (
              <div key={ingredient._id} className="ingredient-item" style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedIngredients.includes(ingredient._id)}
                    onChange={() => handleIngredientToggle(ingredient._id)}
                    style={{ marginRight: '10px' }}
                  />
                  <span>
                    <strong>{ingredient.name}</strong> - {ingredient.category}
                    {ingredient.quantity <= 0 && <span style={{ color: 'red', marginLeft: '10px' }}>(Out of stock)</span>}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="form-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button type="submit" className="btn-primary">
            {meal ? 'Update Meal' : 'Create Meal'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default MealForm;