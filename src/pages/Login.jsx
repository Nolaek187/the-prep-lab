import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, error: authError, setError } = useAuth();

  // Validation function
  const validateForm = () => {
    const errors = {};

    // Email validation
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await login(email.trim(), password);

      if (result.success) {
        // Check if user is admin
        if (result.user.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          const errorMsg = `Access denied. You are logged in as ${result.user.role}. Admin privileges required.`;
          setError(errorMsg);
          // Clear stored credentials if not admin
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } else {
        // Error is already set by the login function
        console.error('Login failed:', result.error);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    // Clear email error when user starts typing
    if (fieldErrors.email) {
      setFieldErrors({ ...fieldErrors, email: '' });
    }
    // Clear auth error when user starts typing
    if (authError) {
      setError(null);
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    // Clear password error when user starts typing
    if (fieldErrors.password) {
      setFieldErrors({ ...fieldErrors, password: '' });
    }
    // Clear auth error when user starts typing
    if (authError) {
      setError(null);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <h1>The Prep Lab</h1>
            <p>Admin Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {authError && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                <div className="alert-content">
                  <span className="alert-title">Login Failed</span>
                  <span className="alert-message">{authError}</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="admin@thepreplap.com"
                required
                disabled={loading}
                className={fieldErrors.email ? 'input-error' : ''}
              />
              {fieldErrors.email && (
                <span className="field-error">
                  <span className="error-icon">✕</span>
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter your password"
                required
                disabled={loading}
                className={fieldErrors.password ? 'input-error' : ''}
              />
              {fieldErrors.password && (
                <span className="field-error">
                  <span className="error-icon">✕</span>
                  {fieldErrors.password}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>© 2026 The Prep Lab. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;