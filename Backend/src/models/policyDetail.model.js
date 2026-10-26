import mongoose from 'mongoose';

/**
 * PolicyDetail Mongoose Schema
 * 
 * Represents an individual insurance policy held by a user.
 * Separates specific insurance coverage specifications (coverage type, covered person/age,
 * sum insured, premium, previous claims, nominee) from the primary User identity model.
 * Each document stores a foreign key reference (`userId`) linking directly to the owner.
 */
const policyDetailSchema = new mongoose.Schema(
  {
    // Foreign key reference to the owner user
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner User ID is required for policy association'],
      index: true
    },

    // Unique policy reference code
    policyNumber: {
      type: String,
      required: [true, 'Policy Number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },

    // Commercial plan or policy designation name
    policyName: {
      type: String,
      required: [true, 'Policy Name is required'],
      trim: true,
      default: 'Standard Insurance Plan'
    },

    // Category / Line of insurance (Strictly 10 Enterprise Domains)
    insuranceType: {
      type: String,
      enum: [
        'AUTO',
        'HEALTH',
        'HOME',
        'LIFE',
        'COMMERCIAL',
        'ACCIDENT',
        'AGRICULTURE',
        'TRAVEL',
        'LIABILITY',
        'GENERAL'
      ],
      default: 'GENERAL',
      index: true
    },

    // Who is covered under this specific policy
    whoIsInsured: {
      type: String,
      enum: [
        '',
        'SELF',
        'SPOUSE',
        'FATHER',
        'MOTHER',
        'PARENTS',
        'CHILD',
        'SON',
        'DAUGHTER',
        'BROTHER',
        'SISTER',
        'SIBLING',
        'GRANDFATHER',
        'GRANDMOTHER',
        'GRANDPARENT',
        'FAMILY',
        'BUSINESS',
        'ASSET',
        'OTHER'
      ],
      default: ''
    },

    // Full name of the insured person (collected via AI chat or profile form)
    insuredName: {
      type: String,
      trim: true,
      default: ''
    },

    // Age of the insured person or asset age
    coveredAge: {
      type: Number,
      default: null
    },

    // Health conditions or specific property/vehicle risks (collected via AI chat or profile form)
    healthOrRiskConditions: {
      type: String,
      trim: true,
      default: ''
    },

    // Total coverage / sum insured amount (e.g. $500,000 or ₹10,00,000)
    sumInsured: {
      type: String,
      trim: true,
      default: ''
    },

    // Duration of policy coverage (e.g. 1 Year, 3 Years, Till Age 65)
    policyTerm: {
      type: String,
      trim: true,
      default: '1 Year'
    },

    // Cost / premium rate (e.g. $120 / month or ₹15,000 / year)
    premium: {
      type: String,
      trim: true,
      default: ''
    },

    // Prior policy history flags
    hasExistingPolicy: {
      type: Boolean,
      default: false
    },
    previousInsurer: {
      type: String,
      trim: true,
      default: ''
    },

    // Prior insurance claims history
    hasPastClaims: {
      type: Boolean,
      default: false
    },
    pastClaimsDetails: {
      type: String,
      trim: true,
      default: ''
    },

    // Beneficiary / nominee designation
    nomineeName: {
      type: String,
      trim: true,
      default: ''
    },
    nomineeRelationship: {
      type: String,
      trim: true,
      default: ''
    },

    // Current policy lifecycle status
    status: {
      type: String,
      enum: ['ACTIVE', 'PENDING', 'EXPIRED', 'CLAIM_IN_PROGRESS'],
      default: 'ACTIVE',
      index: true
    },

    // Coverage effective dates
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    },

    // Additional policy notes or remarks
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export const PolicyDetail = mongoose.model('PolicyDetail', policyDetailSchema);
