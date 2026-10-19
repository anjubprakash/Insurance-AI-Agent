import { policyDocumentService } from '../services/policyDocument.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// 1. Upload & Index Policy Document (Multipart file)
export const uploadPolicyDocument = asyncHandler(async (req, res) => {
  const result = await policyDocumentService.uploadAndProcessDocument(req.file, req.body, req.user);
  return ApiResponse.created(res, result, 'Policy document received and verification initiated.');
});

// 2. Poll Real-Time Upload & Indexing Progress
export const getUploadProgress = asyncHandler(async (req, res) => {
  const progress = policyDocumentService.getUploadProgress(req.params.uploadId);
  return ApiResponse.success(res, progress, 'Upload progress status');
});

// 3. List All Policy Documents
export const listPolicyDocuments = asyncHandler(async (req, res) => {
  const result = await policyDocumentService.listPolicyDocuments(req.query);
  return ApiResponse.success(res, result, 'Policy documents retrieved successfully');
});

// 4. Get Single Policy Document By ID
export const getPolicyDocumentById = asyncHandler(async (req, res) => {
  const doc = await policyDocumentService.getPolicyDocumentById(req.params.id);
  return ApiResponse.success(res, doc, 'Policy document retrieved successfully');
});

// 5. Get Chunks for Single Policy Document
export const getPolicyDocumentChunks = asyncHandler(async (req, res) => {
  const chunks = await policyDocumentService.getPolicyDocumentChunks(req.params.id);
  return ApiResponse.success(res, chunks, 'Policy document chunks retrieved successfully');
});

// 6. Delete Policy Document (MongoDB + Qdrant + File)
export const deletePolicyDocument = asyncHandler(async (req, res) => {
  const result = await policyDocumentService.deletePolicyDocument(req.params.id);
  return ApiResponse.success(res, result, 'Policy document and vectors removed successfully');
});
