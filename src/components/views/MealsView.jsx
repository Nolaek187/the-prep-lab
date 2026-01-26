import React, { useState, useEffect } from 'react';
import { mealsAPI } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import MealForm from '../MealForm';
import '../../styles/views/MealsView.css';

const MealsView = () => {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);

  const limit = 10;

  useEffect(() => {
    if (!isFormVisible) {
      fetchMeals();
    }
  }, [page, searchTerm, isFormVisible]);

  const fetchMeals = async () => {
    setLoading(true);
    setError(null);

    try {
      const filters = {};
      if (searchTerm) filters.search = searchTerm;

      const response = await mealsAPI.getAll(page, limit, filters);
      setMeals(response.data.meals);
      setTotalPages(response.data.pages);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch meals';
      setError(errorMessage);
      console.error('Error fetching meals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const handleAddNew = () => {
    setEditingMeal(null);
    setIsFormVisible(true);
  };

  const handleEdit = (meal) => {
    setEditingMeal(meal);
    setIsFormVisible(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this meal?')) {
      try {
        await mealsAPI.delete(id);
        fetchMeals();
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'Failed to delete meal';
        setError(errorMessage);
        console.error('Error deleting meal:', err);
      }
    }
  };

  const handleSave = () => {
    setIsFormVisible(false);
    setEditingMeal(null);
    fetchMeals();
  };

  const handleCancel = () => {
    setIsFormVisible(false);
    setEditingMeal(null);
  };

  if (isFormVisible) {
    return (
      <div className="view-container">
        <MealForm meal={editingMeal} onSave={handleSave} onCancel={handleCancel} />
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>Meals Management</h2>
          <p className="view-subtitle">Manage and view all meals in the system</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary">
          + Add New Meal
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      <div className="view-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={handleSearch}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : meals.length === 0 ? (
        <div className="empty-state">
          <p>No meals found</p>
          <button onClick={handleAddNew} className="btn-primary">
            Create Your First Meal
          </button>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="meals-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Portion Size</th>
                  <th>Prep Time</th>
                  <th>Allergens</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((meal) => (
                  <tr key={meal._id}>
                    <td className="cell-name">{meal.name}</td>
                    <td className="cell-description">{meal.description || 'N/A'}</td>
                    <td className="cell-price">${meal.price?.toFixed(2) || 'N/A'}</td>
                    <td className="cell-portion">{meal.portionSize || 'N/A'}</td>
                    <td className="cell-time">{meal.preparationTime || 'N/A'} min</td>
                    <td className="cell-allergens">
                      {meal.allergens && meal.allergens.length > 0
                        ? meal.allergens.map((allergen, idx) => (
                            <span key={idx} className="allergen-badge">
                              {allergen}
                            </span>
                          ))
                        : 'None'}
                    </td>
                    <td className="cell-actions">
                      <button
                        onClick={() => handleEdit(meal)}
                        className="btn-edit"
                        title="Edit meal"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(meal._id)}
                        className="btn-delete"
                        title="Delete meal"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              onClick={handlePreviousPage}
              disabled={page === 1}
              className="pagination-btn"
            >
              ← Previous
            </button>

            <span className="pagination-info">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={handleNextPage}
              disabled={page === totalPages}
              className="pagination-btn"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MealsView;