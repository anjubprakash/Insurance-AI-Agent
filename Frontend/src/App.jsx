import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

function AppContent() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <DashboardPage /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
