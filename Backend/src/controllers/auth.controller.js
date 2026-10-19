import { authService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * AuthController
 * 
 * Handles HTTP requests for user authentication and user profile identity management.
 * Policy CRUD endpoints are managed separately by PolicyDetailController (/api/policies).
 */

// 1. CREATE (Signup)
export const signup = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  return ApiResponse.created(res, result, 'Account created successfully. Please log in.');
});

// 2. LOGIN
export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  return ApiResponse.success(res, result, 'Logged in successfully');
});

// 3. READ ALL (Get All Users)
export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await authService.getAllUsers(req.query);
  return ApiResponse.success(res, users, 'Users retrieved successfully');
});

// 4. READ ONE (Get User By ID)
export const getUserById = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.params.id);
  return ApiResponse.success(res, user, 'User retrieved successfully');
});

// 5. UPDATE (Update User By ID)
export const updateUser = asyncHandler(async (req, res) => {
  const user = await authService.updateUser(req.params.id, req.body);
  return ApiResponse.success(res, user, 'User updated successfully');
});

// 6. READ PROFILE (Get currently authenticated user's profile)
export const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user._id);
  return ApiResponse.success(res, user, 'Profile retrieved successfully');
});

// 7. UPDATE PROFILE (Update currently authenticated user's identity & KYC consent)
export const updateProfile = asyncHandler(async (req, res) => {
  const updatedUser = await authService.updateUser(req.user._id, req.body);
  return ApiResponse.success(res, updatedUser, 'Profile updated successfully');
});
