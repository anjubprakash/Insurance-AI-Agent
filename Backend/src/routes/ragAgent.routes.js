import { Router } from 'express';
import {
  queryInsuranceAgent,
  searchPolicyClauses,
  getCacheMetrics,
  clearPromptCache
} from '../controllers/ragAgent.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Cache management endpoints
router.get('/cache/metrics', getCacheMetrics);
router.post('/cache/clear', clearPromptCache);

// All AI Agent routes require an authenticated user session
router.use(authenticate);

router.post('/query', queryInsuranceAgent);
router.get('/search', searchPolicyClauses);

export default router;
