import express from 'express';
import {
  listPolicyOffers,
  getPolicyOfferById,
  updatePolicyOffer,
  deletePolicyOffer
} from '../controllers/policyOffer.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All Policy Offer routes require authentication
router.use(authenticate);

// List & view policy offers
router.get('/', listPolicyOffers);
router.get('/:id', getPolicyOfferById);

// Update & Delete policy offer (restricted to ADMIN and EMPLOYEE roles)
router.put('/:id', authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'EMPLOYEE'), updatePolicyOffer);
router.patch('/:id', authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'EMPLOYEE'), updatePolicyOffer);
router.delete('/:id', authorizeRoles('COMPANY_ADMIN', 'ADMIN', 'EMPLOYEE'), deletePolicyOffer);

export default router;
