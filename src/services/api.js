import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data);
    }

    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  logout: () =>
    api.post('/auth/logout'),

  getCurrentUser: () =>
    api.get('/auth/me'),

  refreshToken: () =>
    api.post('/auth/refresh-token')
};

// Ingredients API calls
export const ingredientsAPI = {
  getAll: (page = 1, limit = 20, filters = {}) =>
    api.get('/ingredients', {
      params: { page, limit, ...filters }
    }),

  getById: (id) =>
    api.get(`/ingredients/${id}`),

  create: (data) =>
    api.post('/ingredients', data),

  update: (id, data) =>
    api.patch(`/ingredients/${id}`, data),

  delete: (id) =>
    api.delete(`/ingredients/${id}`),

  updateQuantity: (id, quantity, type, reason) =>
    api.patch(`/ingredients/${id}/quantity`, {
      quantity,
      type,
      reason
    }),

  getLowStock: () =>
    api.get('/ingredients/stock/low'),

  getExpired: () =>
    api.get('/ingredients/stock/expired'),

  bulkUpdate: (updates) =>
    api.patch('/ingredients/bulk-update', { updates })
};

// Food Orders API calls
export const foodOrdersAPI = {
  getAll: (page = 1, limit = 20, filters = {}) =>
    api.get('/food-orders', {
      params: { page, limit, ...filters }
    }),

  getAllAdmin: (page = 1, limit = 20, filters = {}) =>
    api.get('/food-orders/admin/all', {
      params: { page, limit, ...filters }
    }),

  getById: (id) =>
    api.get(`/food-orders/${id}`),

  create: (data) =>
    api.post('/food-orders', data),

  update: (id, data) =>
    api.patch(`/food-orders/${id}`, data),

  updateStatus: (id, status, notes, estimatedDeliveryTime) =>
    api.patch(`/food-orders/${id}/status`, {
      status,
      notes,
      estimatedDeliveryTime
    }),

  getStats: () =>
    api.get('/food-orders/stats/overview')
};

// Users API calls
export const usersAPI = {
  getAll: (page = 1, limit = 20, filters = {}) =>
    api.get('/users', {
      params: { page, limit, ...filters }
    }),

  getById: (id) =>
    api.get(`/users/${id}`),

  create: (data) =>
    api.post('/users', data),

  update: (id, data) =>
    api.patch(`/users/${id}`, data),

  delete: (id) =>
    api.delete(`/users/${id}`)
};


export const mealsAPI = {
  getAll: (page = 1, limit = 20, filters = {}) =>
    api.get('/meals', {
      params: { page, limit, ...filters }
    }),

  getById: (id) =>
    api.get(`/meals/${id}`),

  create: (data) =>
    api.post('/meals', data),

  update: (id, data) =>
    api.put(`/meals/${id}`, data),

  delete: (id) =>
    api.delete(`/meals/${id}`)
};

export default api;