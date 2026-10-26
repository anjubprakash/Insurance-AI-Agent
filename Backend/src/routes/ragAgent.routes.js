import { Router } from 'express';
import {
  queryInsuranceAgent,
  searchPolicyClauses
} from '../controllers/ragAgent.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// All AI Agent routes require an authenticated user session
router.use(authenticate);

router.post('/query', queryInsuranceAgent);
router.get('/search', searchPolicyClauses);

export default router;
