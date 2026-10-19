import { policyOfferService } from '../services/policyOffer.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * ============================================================================
 * POLICY OFFER CONTROLLER
 * ============================================================================
 * Handles HTTP requests for individual policy products / offers.
 */

export const listPolicyOffers = asyncHandler(async (req, res) => {
  const result = await policyOfferService.listOffers(req.query);
  return ApiResponse.success(res, result, 'Policy offers retrieved successfully');
});

export const getPolicyOfferById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const offer = await policyOfferService.getOfferById(id);
  return ApiResponse.success(res, { offer }, 'Policy offer retrieved successfully');
});

export const updatePolicyOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await policyOfferService.updateOffer(id, req.body);
  return ApiResponse.success(
    res,
    { offer: updated },
    `Policy offer '${updated.policyReferenceCode}' updated and re-vectorized`
  );
});

export const deletePolicyOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await policyOfferService.deleteOffer(id);
  return ApiResponse.success(
    res,
    result,
    `Policy offer '${result.policyReferenceCode}' removed from database and vector index`
  );
});
