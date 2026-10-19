import api from './client.js';

// 1. Signup / Register User (Returns user without token)
export const signupApi = async (userData) => {
  return await api.post('/auth/signup', userData);
};

// 2. Login User (Returns user + JWT Bearer token)
export const loginApi = async (credentials) => {
  return await api.post('/auth/login', credentials);
};

// 3. Get All Users (Admin / Staff)
export const getAllUsersApi = async (params = {}) => {
  return await api.get('/auth/users', { params });
};

// 4. Get Current Authenticated User Profile
export const getProfileApi = async () => {
  return await api.get('/auth/profile');
};

// 5. Update Current Authenticated User Profile (Identity, Contact & KYC Consent)
export const updateProfileApi = async (profileData) => {
  return await api.put('/auth/profile', profileData);
};
