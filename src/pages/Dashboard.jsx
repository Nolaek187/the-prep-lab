import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import UsersView from '../components/views/UsersView';
import IngredientsView from '../components/views/IngredientsView';
import MealsView from '../components/views/MealsView';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [activeView, setActiveView] = useState('users');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'users':
        return <UsersView />;
      case 'ingredients':
        return <IngredientsView />;
      case 'meals':
        return <MealsView />;
      default:
        return <UsersView />;
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main className="dashboard-main">
        <div className="dashboard-content">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;