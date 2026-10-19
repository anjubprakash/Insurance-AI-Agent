import api from './client.js';

/**
 * Policy API Client
 * 
 * Provides HTTP client bindings to the dedicated /api/policies backend endpoints.
 * Handles creating, querying, updating, and removing individual insurance policies.
 */

// 1. Create a new insurance policy (automatically linked to current user)
export const createPolicyApi = async (policyData) => {
  return await api.post('/policies', policyData);
};

// 2. Fetch all insurance policies belonging to the authenticated user
export const getMyPoliciesApi = async () => {
  return await api.get('/policies/my-policies');
};

// 3. Update an existing policy by its database ID
export const updatePolicyApi = async (policyId, policyData) => {
  return await api.put(`/policies/${policyId}`, policyData);
};

// 4. Delete a policy by its database ID
export const deletePolicyApi = async (policyId) => {
  return await api.delete(`/policies/${policyId}`);
};
