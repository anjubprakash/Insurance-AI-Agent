import { answerInsuranceQuery } from '../services/ragAgent.service.js';
import { searchSimilarPolicyClauses } from '../services/vectorStore.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Ask Insurance Policy Advisor
 * POST /api/agent/query
 * Body: { question, conversationHistory, policyTypeFilter, policyCodeFilter, planNameFilter }
 */
export const queryInsuranceAgent = asyncHandler(async (req, res) => {
  const {
    question,
    conversationHistory = [],
    policyTypeFilter = null,
    policyCodeFilter = null,
    planNameFilter = null
  } = req.body;

  if (!question || !question.trim()) {
    return ApiResponse.badRequest(res, 'Question is required');
  }

  const result = await answerInsuranceQuery({
    question,
    conversationHistory,
    policyTypeFilter,
    policyCodeFilter,
    planNameFilter,
    user: req.user
  });

  return ApiResponse.success(res, result, 'Advisor response generated');
});

/**
 * 2. Search Similar Policy Clauses
 * GET /api/agent/search?q=...&limit=5&type=AUTO
 */
export const searchPolicyClauses = asyncHandler(async (req, res) => {
  const { q, limit = 5, type } = req.query;
  if (!q || !q.trim()) {
    return ApiResponse.badRequest(res, 'Query parameter "q" is required');
  }

  const filter = type ? { policyType: type } : null;
  const results = await searchSimilarPolicyClauses(q, Number(limit) || 5, filter);

  return ApiResponse.success(res, results, 'Matching policy clauses retrieved');
});

/**
 * 3. Retrieve Operational Cache Metrics
 * GET /api/agent/cache/metrics
 */
export const getCacheMetrics = asyncHandler(async (req, res) => {
  return ApiResponse.success(
    res,
    {
      activeEntries: 0,
      status: 'DISABLED',
      message: 'RAM caching disabled: Data retrieved directly via MongoDB and Vector Search.'
    },
    'Prompt cache metrics'
  );
});

/**
 * 4. Invalidate Cache (No-op since RAM cache is removed)
 * POST /api/agent/cache/clear
 */
export const clearPromptCache = asyncHandler(async (req, res) => {
  return ApiResponse.success(
    res,
    { clearedCount: 0, message: 'RAM caching disabled: Data retrieved directly via MongoDB and Vector Search.' },
    'Prompt cache cleared'
  );
});
