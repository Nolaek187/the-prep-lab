import React, { useState, useEffect, useCallback } from 'react';
import { usersAPI } from '../../services/api';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';
import { useDebounce } from '../../hooks/useDebounce';
import '../../styles/views/UsersView.css';

const UsersView = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const limit = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters = {};
      if (debouncedSearchTerm) filters.search = debouncedSearchTerm;
      if (roleFilter) filters.role = roleFilter;

      console.log('Fetching users with params:', { page, limit, filters });
      const response = await usersAPI.getAll(page, limit, filters);
      console.log('Users response:', response.data);
      
      setUsers(response.data.users);
      setTotalPages(response.data.pages);
    } catch (err) {
      console.error('Full error object:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch users';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, roleFilter, limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleRoleFilter = (e) => {
    setRoleFilter(e.target.value);
    setPage(1);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2>Users Management</h2>
        <p className="view-subtitle">Manage and view all users in the system</p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      <div className="view-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={handleSearch}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <select
          value={roleFilter}
          onChange={handleRoleFilter}
          className="filter-select"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="customer">Customer</option>
          <option value="driver">Driver</option>
          <option value="kitchen_staff">Kitchen Staff</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : users.length === 0 ? (
        <div className="empty-state">
          <p>No users found</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td className="cell-name">{user.name}</td>
                    <td className="cell-email">{user.email}</td>
                    <td className="cell-phone">{user.phone || 'N/A'}</td>
                    <td className="cell-role">
                      <span className={`role-badge role-${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="cell-status">
                      <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="cell-date">
                      {new Date(user.createdAt).toLocaleDateString()}
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

export default UsersView;