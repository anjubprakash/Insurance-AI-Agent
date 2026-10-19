import { Router } from 'express';
import {
  uploadPolicyDocument,
  getUploadProgress,
  listPolicyDocuments,
  getPolicyDocumentById,
  getPolicyDocumentChunks,
  deletePolicyDocument
} from '../controllers/policyDocument.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = Router();

// All Policy Document routes require authentication
router.use(authenticate);

// Progress polling
router.get('/upload-progress/:uploadId', getUploadProgress);

// Viewing documents & chunks
router.get('/', listPolicyDocuments);
router.get('/:id', getPolicyDocumentById);
router.get('/:id/chunks', getPolicyDocumentChunks);

// Admin / Staff: Upload & Delete
router.post(
  '/',
  authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'EMPLOYEE'),
  upload.single('file'),
  uploadPolicyDocument
);

router.delete(
  '/:id',
  authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'EMPLOYEE'),
  deletePolicyDocument
);

export default router;
