import api from './client.js';

/**
 * Fetch all policy documents with optional filters (policyType, status, search)
 */
export const listDocumentsApi = async (params = {}) => {
  return await api.get('/policy-documents', { params });
};

/**
 * Fetch clauses for a single policy document
 */
export const getDocumentChunksApi = async (id) => {
  return await api.get(`/policy-documents/${id}/chunks`);
};

/**
 * Upload an insurance policy document
 */
export const uploadDocumentApi = async (formData, onProgress = null) => {
  return await api.post('/policy-documents', formData, {
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    }
  });
};

/**
 * Poll live upload progress
 */
export const getUploadProgressApi = async (uploadId) => {
  return await api.get(`/policy-documents/upload-progress/${uploadId}`);
};

/**
 * Delete a policy document
 */
export const deleteDocumentApi = async (id) => {
  return await api.delete(`/policy-documents/${id}`);
};

/**
 * Query the Insurance Policy Advisor scoped to a specific plan or category
 */
export const queryAgentApi = async ({
  question,
  conversationHistory = [],
  policyTypeFilter = null,
  policyCodeFilter = null,
  planNameFilter = null
}) => {
  return await api.post('/agent/query', {
    question,
    conversationHistory,
    policyTypeFilter,
    policyCodeFilter,
    planNameFilter
  });
};

/**
 * Fetch individual policy offers with filters
 */
export const listPolicyOffersApi = async (params = {}) => {
  return await api.get('/policy-offers', { params });
};

/**
 * Update an individual policy offer
 */
export const updatePolicyOfferApi = async (id, data) => {
  return await api.put(`/policy-offers/${id}`, data);
};

/**
 * Delete an individual policy offer
 */
export const deletePolicyOfferApi = async (id) => {
  return await api.delete(`/policy-offers/${id}`);
};
