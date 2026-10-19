import { PolicyDetail } from '../models/policyDetail.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';

/**
 * PolicyDetailService
 * 
 * Manages CRUD operations for insurance policies in the PolicyDetail collection.
 * Stores `userId` on each policy document and maintains a reference (`policyId` + `policyName`)
 * in the User's `policies` array without duplicating other policy attributes.
 */
class PolicyDetailService {
  /**
   * CREATE: Issues/attaches a new insurance policy to a user.
   * Stores `userId` on PolicyDetail and pushes `{ policyId, policyName }` to `user.policies`.
   */
  async createPolicy(userId, data) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Target user not found');
    }

    // Auto-generate clean policy reference number if not supplied
    const typeCode = (data.insuranceType ).slice(0, 4).toUpperCase();
    const policyNumber =
      data.policyNumber?.trim()?.toUpperCase() ||
      `POL-${Math.floor(1000 + Math.random() * 9000)}-${typeCode}`;

    // Verify uniqueness of policyNumber
    const existing = await PolicyDetail.findOne({ policyNumber });
    if (existing) {
      throw ApiError.conflict(`Policy number "${policyNumber}" already exists.`);
    }

    // Create the PolicyDetail record with foreign key userId
    const policy = await PolicyDetail.create({
      userId: user._id,
      policyNumber,
      policyName: data.policyName || 'Standard Insurance Plan',
      insuranceType: data.insuranceType,
      whoIsInsured: data.whoIsInsured || 'SELF',
      insuredName: data.insuredName || '',
      coveredAge: data.coveredAge !== undefined && data.coveredAge !== '' ? Number(data.coveredAge) : null,
      healthOrRiskConditions: data.healthOrRiskConditions || '',
      sumInsured: data.sumInsured || '',
      policyTerm: data.policyTerm || '1 Year',
      premium: data.premium || '',
      hasExistingPolicy: Boolean(data.hasExistingPolicy),
      previousInsurer: data.previousInsurer || '',
      hasPastClaims: Boolean(data.hasPastClaims),
      pastClaimsDetails: data.pastClaimsDetails || '',
      nomineeName: data.nomineeName || '',
      nomineeRelationship: data.nomineeRelationship || '',
      status: data.status || 'ACTIVE',
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate
        ? new Date(data.endDate)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      notes: data.notes || ''
    });

    // Store only the ObjectId reference (policyId) and policyName in User's policies array
    if (!Array.isArray(user.policies)) {
      user.policies = [];
    }
    user.policies.push({
      policyId: policy._id,
      policyName: policy.policyName
    });

    await user.save();

    // Return created policy populated with user details
    return await PolicyDetail.findById(policy._id).populate(
      'userId',
      'name email phone customerId city pincode preferredLanguage'
    );
  }

  /**
   * READ: Get all policies belonging to a specific user.
   * Populates owner user identity for each policy.
   */
  async getUserPolicies(userId) {
    return await PolicyDetail.find({ userId })
      .populate('userId', 'name email phone customerId city pincode')
      .sort({ createdAt: -1 });
  }

  /**
   * READ: Get single policy by ID.
   * Populates complete user model details.
   */
  async getPolicyById(policyId) {
    const policy = await PolicyDetail.findById(policyId).populate(
      'userId',
      'name email phone customerId dateOfBirth age gender city pincode preferredLanguage'
    );
    if (!policy) {
      throw ApiError.notFound('Policy not found');
    }
    return policy;
  }

  /**
   * UPDATE: Updates policy parameters in PolicyDetail and keeps `policyName` synced in User.policies.
   */
  async updatePolicy(policyId, requestingUserId, updateData, userRole = 'POLICYHOLDER') {
    const policy = await PolicyDetail.findById(policyId);
    if (!policy) {
      throw ApiError.notFound('Policy not found');
    }

    // Access check: Policyholder can only update their own policies
    const isOwner = policy.userId.toString() === requestingUserId.toString();
    const isStaff = userRole === 'ADMIN' || userRole === 'COMPANY_ADMIN' || userRole === 'EMPLOYEE';
    if (!isOwner && !isStaff) {
      throw ApiError.forbidden('You are not authorized to update this policy');
    }

    const updatableFields = [
      'policyName',
      'insuranceType',
      'whoIsInsured',
      'insuredName',
      'coveredAge',
      'healthOrRiskConditions',
      'sumInsured',
      'policyTerm',
      'premium',
      'hasExistingPolicy',
      'previousInsurer',
      'hasPastClaims',
      'pastClaimsDetails',
      'nomineeName',
      'nomineeRelationship',
      'status',
      'startDate',
      'endDate',
      'notes'
    ];

    for (const field of updatableFields) {
      if (updateData[field] !== undefined) {
        policy[field] = updateData[field];
      }
    }

    await policy.save();

    // Synchronize policyName in User's policies array if changed
    if (updateData.policyName !== undefined) {
      const user = await User.findById(policy.userId);
      if (user && Array.isArray(user.policies)) {
        const idx = user.policies.findIndex(
          (p) => p.policyId?.toString() === policy._id.toString()
        );
        if (idx !== -1) {
          user.policies[idx].policyName = policy.policyName;
          await user.save();
        }
      }
    }

    return await PolicyDetail.findById(policy._id).populate(
      'userId',
      'name email phone customerId city pincode preferredLanguage'
    );
  }

  /**
   * DELETE: Deletes an insurance policy and removes its reference from User's policies array.
   */
  async deletePolicy(policyId, requestingUserId, userRole = 'POLICYHOLDER') {
    const policy = await PolicyDetail.findById(policyId);
    if (!policy) {
      throw ApiError.notFound('Policy not found');
    }

    // Access check
    const isOwner = policy.userId.toString() === requestingUserId.toString();
    const isStaff = userRole === 'ADMIN' || userRole === 'COMPANY_ADMIN' || userRole === 'EMPLOYEE';
    if (!isOwner && !isStaff) {
      throw ApiError.forbidden('You are not authorized to delete this policy');
    }

    const ownerUserId = policy.userId;
    const deletedPolicyNumber = policy.policyNumber;

    await PolicyDetail.findByIdAndDelete(policyId);

    // Remove reference from User's policies array
    const user = await User.findById(ownerUserId);
    if (user && Array.isArray(user.policies)) {
      user.policies = user.policies.filter(
        (p) => p.policyId?.toString() !== policyId.toString()
      );
      await user.save();
    }

    return {
      success: true,
      message: `Policy ${deletedPolicyNumber} deleted successfully`,
      policyNumber: deletedPolicyNumber
    };
  }

  /**
   * READ ALL: For staff and administrators to query all policies across all users.
   * Populates owner user information for each entry.
   */
  async getAllPolicies(queryParams = {}) {
    const { insuranceType, status, search } = queryParams;
    const filter = {};

    if (insuranceType) filter.insuranceType = insuranceType;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { policyNumber: { $regex: search, $options: 'i' } },
        { policyName: { $regex: search, $options: 'i' } },
        { nomineeName: { $regex: search, $options: 'i' } }
      ];
    }

    return await PolicyDetail.find(filter)
      .populate('userId', 'name email phone customerId city pincode')
      .sort({ createdAt: -1 });
  }
}

export const policyDetailService = new PolicyDetailService();
