import mongoose from 'mongoose';

/**
 * Embedded Chunk Sub-Schema
 * Stores each semantic policy chunk and its 384-dimensional dense vector embedding
 * directly in MongoDB so vector similarity search works 100% from the database.
 */
const policyChunkSchema = new mongoose.Schema(
  {
    chunkId: {
      type: String,
      required: true
    },
    chunkIndex: {
      type: Number,
      required: true
    },
    sectionTitle: {
      type: String,
      default: ''
    },
    clauseCode: {
      type: String,
      default: ''
    },
    clauseType: {
      type: String,
      default: 'Coverage Term'
    },
    isExclusion: {
      type: Boolean,
      default: false
    },
    isSchedule: {
      type: Boolean,
      default: false
    },
    isExcess: {
      type: Boolean,
      default: false
    },
    isFnolRule: {
      type: Boolean,
      default: false
    },
    content: {
      type: String,
      required: true
    },
    vector: {
      type: [Number],
      default: []
    }
  },
  { _id: false }
);

const policyDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Policy document title is required'],
      trim: true
    },
    policyType: {
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
        'GENERAL',
        'MULTIPLE'
      ],
      default: 'GENERAL'
    },
    lineOfBusiness: {
      type: String,
      trim: true,
      default: 'Personal & Commercial Lines'
    },
    policyCode: {
      type: String,
      trim: true,
      default: ''
    },
    isBatchCatalogue: {
      type: Boolean,
      default: false
    },
    totalOffersCount: {
      type: Number,
      default: 0
    },
    version: {
      type: String,
      default: '1.0'
    },
    isLatestVersion: {
      type: Boolean,
      default: true
    },
    previousVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PolicyDocument',
      default: null
    },
    fileHash: {
      type: String,
      required: true
    },
    originalFileName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      default: 0
    },
    rawText: {
      type: String,
      required: true
    },
    // Stored semantic chunks and their 384-dim dense vectors in MongoDB
    chunks: {
      type: [policyChunkSchema],
      default: []
    },
    status: {
      type: String,
      enum: ['UPLOADED', 'PARSED', 'INDEXING', 'INDEXED', 'FAILED', 'SUPERSEDED'],
      default: 'UPLOADED'
    },
    chunkCount: {
      type: Number,
      default: 0
    },
    wordCount: {
      type: Number,
      default: 0
    },
    totalRagTokens: {
      type: Number,
      default: 0
    },
    gatekeeperScore: {
      type: Number,
      default: 0
    },
    gatekeeperStatus: {
      type: String,
      enum: ['APPROVED', 'REJECTED', 'BYPASS'],
      default: 'APPROVED'
    },
    gatekeeperReasoning: {
      type: String,
      default: ''
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
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

// Helpful indexes on hash, code, and status for search and deduplication
policyDocumentSchema.index({ fileHash: 1 });
policyDocumentSchema.index({ policyCode: 1, status: 1 });
policyDocumentSchema.index({ policyType: 1 });

export const PolicyDocument = mongoose.model('PolicyDocument', policyDocumentSchema);
