import React, { useState, useEffect } from 'react';
import { mealsAPI } from '../services/api';
import MealForm from '../components/MealForm';

const MealManagement = () => {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);

  const fetchMeals = async () => {
    try {
      setLoading(true);
      const response = await mealsAPI.getAll(page, limit);
      setMeals(response.data.meals);
      setTotalPages(response.data.pages);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch meals');
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
    // Only fetch meals when the form is not visible
    if (!isFormVisible) {
      fetchMeals();
    }
  }, [page, limit, isFormVisible]);

  const handleAddNewMeal = () => {
    console.log('Opening form to add a new meal.');
    setEditingMeal(null);
    setIsFormVisible(true);
  };

  const handleEdit = (meal) => {
    console.log('Opening form to edit meal:', meal);
    setEditingMeal(meal);
    setIsFormVisible(true);
  };

  const handleSave = () => {
    console.log('Meal saved, closing form and refreshing meal list.');
    setIsFormVisible(false);
    setEditingMeal(null);
    // The useEffect will trigger a refetch because isFormVisible changes to false
  };

  const handleCancel = () => {
    console.log('Canceling form.');
    setIsFormVisible(false);
    setEditingMeal(null);
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this meal?')) {
      try {
        await mealsAPI.delete(id);
        // Refresh the list of meals after deletion
        fetchMeals();
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to delete meal');
         console.error('Error deleting meal:', err);
      }
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  if (loading) {
    return <div>Loading meals...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Meal Management</h1>

      {isFormVisible ? (
        <MealForm meal={editingMeal} onSave={handleSave} onCancel={handleCancel} />
      ) : (
        <>
          <button onClick={handleAddNewMeal}>Add New Meal</button>
          
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {meals.map((meal) => (
                <tr key={meal._id}>
                  <td>{meal.name}</td>
                  <td>${meal.price.toFixed(2)}</td>
                  <td>
                    <button onClick={() => handleEdit(meal)}>Edit</button>
                    <button onClick={() => handleDelete(meal._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            <button onClick={handlePrevPage} disabled={page <= 1}>
              Previous
            </button>
            <span> Page {page} of {totalPages} </span>
            <button onClick={handleNextPage} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MealManagement;