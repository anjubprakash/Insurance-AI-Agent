import { Router } from 'express';
import {
  createPolicy,
  getMyPolicies,
  getAllPolicies,
  getPolicyById,
  updatePolicy,
  deletePolicy
} from '../controllers/policyDetail.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// All policy endpoints require authentication
router.use(authenticate);

// 1. Create a new policy (stores userId automatically)
router.post('/', createPolicy);

// 2. Get all policies belonging to the current user
router.get('/my-policies', getMyPolicies);

// 3. Get all policies in the system (Staff / Admin directory)
router.get('/', getAllPolicies);

// 4. Get specific policy by ID (populates user details)
router.get('/:id', getPolicyById);

// 5. Update specific policy by ID
router.put('/:id', updatePolicy);

// 6. Delete specific policy by ID
router.delete('/:id', deletePolicy);

export default router;
