import React, { useState, useEffect } from 'react';
import { ingredientsAPI } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import IngredientForm from '../IngredientForm';
import '../../styles/views/IngredientsView.css';

const IngredientsView = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);

  const limit = 10;

  useEffect(() => {
    if (!isFormVisible) {
      fetchIngredients();
    }
  }, [page, searchTerm, categoryFilter, stockFilter, isFormVisible]);

  const fetchIngredients = async () => {
    setLoading(true);
    setError(null);

    try {
      const filters = {};
      if (searchTerm) filters.search = searchTerm;
      if (categoryFilter) filters.category = categoryFilter;
      if (stockFilter) filters.inStock = stockFilter;

      const response = await ingredientsAPI.getAll(page, limit, filters);
      setIngredients(response.data.ingredients);
      setTotalPages(response.data.pages);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch ingredients';
      setError(errorMessage);
      console.error('Error fetching ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleCategoryFilter = (e) => {
    setCategoryFilter(e.target.value);
    setPage(1);
  };

  const handleStockFilter = (e) => {
    setStockFilter(e.target.value);
    setPage(1);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const handleAddNew = () => {
    setEditingIngredient(null);
    setIsFormVisible(true);
  };

  const handleEdit = (ingredient) => {
    setEditingIngredient(ingredient);
    setIsFormVisible(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this ingredient?')) {
      try {
        await ingredientsAPI.delete(id);
        fetchIngredients();
      } catch (err) {
        const errorMessage = err.response?.data?.message || 'Failed to delete ingredient';
        setError(errorMessage);
        console.error('Error deleting ingredient:', err);
      }
    }
  };

  const handleSave = () => {
    setIsFormVisible(false);
    setEditingIngredient(null);
    fetchIngredients();
  };

  const handleCancel = () => {
    setIsFormVisible(false);
    setEditingIngredient(null);
  };

  const getStockStatus = (quantity, reorderLevel) => {
    if (quantity <= 0) return 'out-of-stock';
    if (quantity <= reorderLevel) return 'low-stock';
    return 'in-stock';
  };

  const getStockStatusLabel = (quantity, reorderLevel) => {
    const status = getStockStatus(quantity, reorderLevel);
    if (status === 'out-of-stock') return 'Out of Stock';
    if (status === 'low-stock') return 'Low Stock';
    return 'In Stock';
  };

  if (isFormVisible) {
    return (
      <div className="view-container">
        <IngredientForm 
          ingredient={editingIngredient} 
          onSave={handleSave} 
          onCancel={handleCancel} 
        />
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>Ingredients Management</h2>
          <p className="view-subtitle">Manage and view all ingredients in inventory</p>
        </div>
        <button onClick={handleAddNew} className="btn-primary">
          + Add New Ingredient
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

        <select
          value={categoryFilter}
          onChange={handleCategoryFilter}
          className="filter-select"
        >
          <option value="">All Categories</option>
          <option value="proteins">Proteins</option>
          <option value="starch">Starch</option>
          <option value="vegetables">Vegetables</option>
          <option value="condiments">Condiments</option>
        </select>

        <select
          value={stockFilter}
          onChange={handleStockFilter}
          className="filter-select"
        >
          <option value="">All Stock Status</option>
          <option value="true">In Stock</option>
          <option value="false">Out of Stock</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : ingredients.length === 0 ? (
        <div className="empty-state">
          <p>No ingredients found</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="ingredients-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                  <th>Cost Price</th>
                  <th>Supplier</th>
                  <th>Expiry Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ingredient) => (
                  <tr key={ingredient._id}>
                    <td className="cell-name">{ingredient.name}</td>
                    <td className="cell-category">
                      <span className="category-badge">{ingredient.category}</span>
                    </td>
                    <td className="cell-quantity">{ingredient.quantity}</td>
                    <td className="cell-unit">{ingredient.unit}</td>
                    <td className="cell-reorder">{ingredient.reorderLevel}</td>
                    <td className="cell-status">
                      <span
                        className={`status-badge ${getStockStatus(
                          ingredient.quantity,
                          ingredient.reorderLevel
                        )}`}
                      >
                        {getStockStatusLabel(
                          ingredient.quantity,
                          ingredient.reorderLevel
                        )}
                      </span>
                    </td>
                    <td className="cell-price">
                      ${ingredient.costPrice?.toFixed(2) || 'N/A'}
                    </td>
                    <td className="cell-supplier">{ingredient.supplier || 'N/A'}</td>
                    <td className="cell-expiry">
                      {ingredient.expiryDate
                        ? new Date(ingredient.expiryDate).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="cell-actions">
                      <button
                        onClick={() => handleEdit(ingredient)}
                        className="btn-edit"
                        title="Edit ingredient"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(ingredient._id)}
                        className="btn-delete"
                        title="Delete ingredient"
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

export default IngredientsView;