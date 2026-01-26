import React from 'react';
import '../styles/components/LoadingSpinner.css';

const LoadingSpinner = () => {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <p>Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;