import mongoose from 'mongoose';

/**
 * ============================================================================
 * POLICY OFFER / CATALOG MODEL
 * ============================================================================
 * Represents an individual insurance product, plan, or offer extracted from
 * tabular batch spreadsheets (.xlsx, .csv) or created directly by an administrator.
 * 
 * In enterprise insurance platforms, a single Excel workbook often contains
 * tens or hundreds of distinct insurance products (e.g., 30 fictional offers across
 * Health, Motor, Life, Property).
 * 
 * Rather than flattening the entire spreadsheet into a single monolithic document,
 * each row is ingested as an independent, queryable, and editable PolicyOffer entity.
 * 
 * Every offer maintains:
 * 1. An individual Policy Reference Code (used or auto-generated at backend)
 * 2. Dedicated MongoDB record for granular CRUD & status tracking
 * 3. A dedicated Qdrant vector point for precision semantic retrieval
 * 4. Two-way linkage to its parent PolicyDocument workbook
 */

const policyOfferSchema = new mongoose.Schema(
  {
    // Parent source document reference (the uploaded Excel workbook or policy catalogue)
    parentDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PolicyDocument',
      required: true,
      index: true
    },

    // Standardized Policy / Offer Reference Code (e.g., 'INS001', 'POL-HLTH-001')
    // Generated automatically by the backend if missing in the uploaded table
    policyReferenceCode: {
      type: String,
      required: [true, 'Policy reference code is required'],
      trim: true,
      index: true
    },

    // Plan or Product Name (e.g., 'Harbor Essential Health', 'Cedar Plus Health')
    planName: {
      type: String,
      required: [true, 'Plan or offer name is required'],
      trim: true,
      index: true
    },

    // Insurance Underwriter / Carrier (e.g., 'Harbor Mutual', 'Cedar Shield')
    insurer: {
      type: String,
      trim: true,
      default: 'General Insurer',
      index: true
    },

    // Policy Domain Category (Strictly 10 Enterprise Domains)
    policyCategory: {
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

    // Subtype / Plan Classification (e.g., 'Individual medical', 'Comprehensive Fleet')
    coverageSubtype: {
      type: String,
      trim: true,
      default: ''
    },

    // Eligibility criteria: Entry age ranges
    minimumEntryAge: {
      type: Number,
      default: null
    },
    maximumEntryAge: {
      type: Number,
      default: null
    },

    // Maximum or annual coverage limit (e.g., '£100,000', 100000)
    annualCoverageAmount: {
      type: String,
      trim: true,
      default: ''
    },

    // Specific benefit sub-limits (e.g., 'Outpatient £500/year', 'Dental £300')
    benefitSublimits: {
      type: String,
      trim: true,
      default: ''
    },

    // Pricing / Premium amount (e.g., '£42/month', '£500/year')
    illustrativePremium: {
      type: String,
      trim: true,
      default: ''
    },

    // Premium basis assumptions (e.g., 'Adult age 30; illustrative')
    premiumBasis: {
      type: String,
      trim: true,
      default: ''
    },

    // Underwriting conditions & medical/risk factors considered
    risksConsidered: {
      type: String,
      trim: true,
      default: ''
    },

    // Pre-existing conditions exclusions and waiting criteria
    preExistingConditionRules: {
      type: String,
      trim: true,
      default: ''
    },

    // Waiting periods before coverage activates (e.g., '30 days general illness; 12 months specified')
    waitingPeriods: {
      type: String,
      trim: true,
      default: ''
    },

    // Core policy exclusions and restricted treatments
    exclusions: {
      type: String,
      trim: true,
      default: ''
    },

    // Excess / Deductible amount payable per claim (e.g., '£250 per claim')
    excessDeductible: {
      type: String,
      trim: true,
      default: ''
    },

    // Step-by-step claims or FNOL procedure
    claimsProcess: {
      type: String,
      trim: true,
      default: ''
    },

    // Name of sheet in workbook from which this offer originated
    sourceSheet: {
      type: String,
      trim: true,
      default: 'Sheet 1'
    },

    // Original row index within the spreadsheet table
    sourceRowIndex: {
      type: Number,
      default: 0
    },

    // Lifecycle status of the policy offer
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'DRAFT'],
      default: 'ACTIVE',
      index: true
    },

    // Formatted semantic text block used for RAG retrieval
    chunkText: {
      type: String,
      default: ''
    },

    // 384-dimensional dense vector embedding stored directly in MongoDB
    vector: {
      type: [Number],
      default: []
    },

    // Qdrant vector point UUID for direct point updating and deletion
    qdrantPointId: {
      type: String,
      default: ''
    },

    // Flexible key-value metadata store preserving any unmapped custom spreadsheet columns
    metadata: {
      type: Map,
      of: String,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for high-speed multi-criteria filtering
policyOfferSchema.index({ policyCategory: 1, insurer: 1 });
policyOfferSchema.index({ parentDocumentId: 1, policyReferenceCode: 1 });

export const PolicyOffer = mongoose.model('PolicyOffer', policyOfferSchema);
