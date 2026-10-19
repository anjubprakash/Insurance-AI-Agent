import { policyDetailService } from '../services/policyDetail.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * PolicyDetailController
 *  Provides HTTP endpoints for policy lifecycle management.
 */

// 1. CREATE POLICY
// Attaches a new insurance policy to the requesting user 
export const createPolicy = asyncHandler(async (req, res) => {
  const targetUserId = req.body.userId || req.user._id;
  const policy = await policyDetailService.createPolicy(targetUserId, req.body);
  return ApiResponse.created(res, policy, 'Insurance policy created successfully');
});

// 2. GET CURRENT USER'S POLICIES
// Fetches all policies owned by the authenticated user with populated user identity.
export const getMyPolicies = asyncHandler(async (req, res) => {
  const policies = await policyDetailService.getUserPolicies(req.user._id);
  return ApiResponse.success(res, policies, 'User policies retrieved successfully');
});

// 3. GET ALL POLICIES (Admin / Operations)
// Retrieves all system policies with populated user identity details for administrative review.
export const getAllPolicies = asyncHandler(async (req, res) => {
  const policies = await policyDetailService.getAllPolicies(req.query);
  return ApiResponse.success(res, policies, 'All policies retrieved successfully');
});

// 4. GET SINGLE POLICY BY ID
// Retrieves an individual policy record by its unique database ID with full populated user details.
export const getPolicyById = asyncHandler(async (req, res) => {
  const policy = await policyDetailService.getPolicyById(req.params.id);
  return ApiResponse.success(res, policy, 'Policy retrieved successfully');
});

// 5. UPDATE POLICY
// Updates policy parameters (terms, sum insured, premium, status, nominee) and updates user summary.
export const updatePolicy = asyncHandler(async (req, res) => {
  const updatedPolicy = await policyDetailService.updatePolicy(
    req.params.id,
    req.user._id,
    req.body,
    req.user.role
  );
  return ApiResponse.success(res, updatedPolicy, 'Policy updated successfully');
});

// 6. DELETE POLICY
// Permanently removes a policy from PolicyDetail collection and unlinks it from the user.
export const deletePolicy = asyncHandler(async (req, res) => {
  const result = await policyDetailService.deletePolicy(
    req.params.id,
    req.user._id,
    req.user.role
  );
  return ApiResponse.success(res, result, 'Policy deleted successfully');
});
