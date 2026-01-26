import React from 'react';
import '../styles/components/ErrorAlert.css';

const ErrorAlert = ({ message, onClose }) => {
  return (
    <div className="error-alert">
      <div className="error-alert-content">
        <span className="error-icon">⚠️</span>
        <div className="error-message">
          <strong>Error</strong>
          <p>{message}</p>
        </div>
        <button className="error-close" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
};

export default ErrorAlert;