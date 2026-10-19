import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, signupApi } from '../api/auth.api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(false);

  // Login handler
  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await loginApi({ email, password });
      const { user: loggedInUser, token: authToken } = res.data;

      setUser(loggedInUser);
      setToken(authToken);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      localStorage.setItem('token', authToken);

      return loggedInUser;
    } finally {
      setLoading(false);
    }
  };

  // Signup handler (Does NOT set token, user must log in)
  const signup = async (formData) => {
    setLoading(true);
    try {
      const res = await signupApi(formData);
      return res.data;
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  // Sync user profile updates to react state and localStorage
  const updateUserSession = (updatedUser) => {
    setUser(updatedUser);
    try {
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (e) {
      console.warn('Failed to persist user to localStorage:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        loading,
        login,
        signup,
        logout,
        updateUserSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
