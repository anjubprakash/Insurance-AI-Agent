import { Router } from 'express';
import {
  signup,
  login,
  getAllUsers,
  getUserById,
  updateUser,
  getProfile,
  updateProfile
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Public Authentication
router.post('/signup', signup);
router.post('/login', login);

// Authenticated User Profile (Identity, Contact & KYC Consent)
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

// Administrator / Staff User Management Routes (Read & Update only - deletion omitted)
router.get('/users', authenticate, getAllUsers);
router.get('/users/:id', authenticate, getUserById);
router.put('/users/:id', authenticate, updateUser);

export default router;
