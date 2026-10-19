import fs from 'fs';
import path from 'path';
import { PolicyDocument } from '../models/policyDocument.model.js';
import { PolicyOffer } from '../models/policyOffer.model.js';
import { calculateFileHash, extractTextFromFile } from './fileParser.service.js';
import { validateInsuranceDocumentWithAI } from './aiGatekeeper.service.js';
import { indexPolicyDocument, getChunksByDocumentId } from './vectorStore.service.js';
import { splitInsurancePolicyIntoSemanticChunks } from './insuranceParser.service.js';
import { policyOfferService } from './policyOffer.service.js';
import { deleteVectorsByDocumentId, deletePointsByIds } from './qdrant.service.js';
import { ApiError } from '../utils/apiError.js';

// In-memory upload progress tracker keyed by client-generated uploadId
export const uploadProgressTracker = new Map();

class PolicyDocumentService {
  /**
   * Process uploaded policy document through AI Gatekeeper, persist in MongoDB, and index into Qdrant
   */
  async uploadAndProcessDocument(file, bodyData = {}, user = null) {
    if (!file) {
      throw ApiError.badRequest('Please upload an insurance document (PDF, Word DOCX, or text)');
    }

    const { title, policyType, lineOfBusiness, policyCode, version = '1.0', uploadId } = bodyData;
    const filePath = file.path;
    const originalFileName = file.originalname;
    const fileSize = file.size;

    try {
      // 1. Calculate SHA-256 hash for duplicate prevention
      const fileHash = calculateFileHash(filePath);

      const existingDoc = await PolicyDocument.findOne({ fileHash });
      if (existingDoc && existingDoc.status === 'INDEXED' && existingDoc.chunkCount > 0) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        throw ApiError.badRequest(
          `Duplicate document: This policy is already indexed as '${existingDoc.title}' (${existingDoc.chunkCount} clauses).`
        );
      }

      // 2. Extract text from file
      const rawText = await extractTextFromFile(filePath);
      if (!rawText || rawText.length < 50) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        throw ApiError.badRequest('The uploaded document appears to be empty or unscannable.');
      }

      // Update progress: Gatekeeper verification
      if (uploadId) {
        uploadProgressTracker.set(uploadId, {
          percent: 15,
          stage: 'gatekeeper',
          message: 'Running AI Gatekeeper authenticity verification...',
          status: 'IN_PROGRESS'
        });
      }

      // 3. AI Gatekeeper verification (4-point stratified sampling)
      const gatekeeperResult = await validateInsuranceDocumentWithAI(rawText, originalFileName);

      if (!gatekeeperResult.isValidInsuranceDocument) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (uploadId) {
          uploadProgressTracker.set(uploadId, {
            percent: 0,
            stage: 'rejected',
            message: `AI Gatekeeper Rejected: ${gatekeeperResult.reasoning}`,
            status: 'FAILED'
          });
          setTimeout(() => uploadProgressTracker.delete(uploadId), 60 * 1000);
        }
        throw ApiError.badRequest(`AI Gatekeeper Rejected: ${gatekeeperResult.reasoning}`);
      }

      // 4. Calculate metrics
      const wordCount = rawText.split(/\s+/).filter(Boolean).length;
      const totalRagTokens = Math.round(wordCount * 1.33);

      // Check for spreadsheet batch catalogue with multiple policy offers
      const ext = path.extname(filePath).toLowerCase();
      const isSpreadsheet = ['.xlsx', '.xls', '.csv'].includes(ext);
      let pendingOffers = [];

      if (isSpreadsheet) {
        try {
          const docSeed = Math.random().toString(36).substring(2, 6).toUpperCase();
          pendingOffers = policyOfferService.extractOffersFromWorkbook(filePath, null, docSeed);
        } catch (parseErr) {
          console.warn('⚠️ Could not extract tabular policy offers from workbook:', parseErr.message);
        }
      }

      const isBatchCatalogue = pendingOffers.length > 0;
      const finalPolicyType = isBatchCatalogue ? 'MULTIPLE' : (policyType || gatekeeperResult.policyType || 'AUTO');

      // 5. Save Policy Document in MongoDB
      const docTitle = title?.trim() || originalFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const policyDoc = await PolicyDocument.create({
        title: docTitle,
        policyType: finalPolicyType,
        lineOfBusiness: lineOfBusiness || (isBatchCatalogue ? 'Multi-Line Insurance Catalogue' : 'Personal & Commercial Lines'),
        policyCode: policyCode || (isBatchCatalogue ? `CAT-${Date.now()}` : `POL-${Date.now()}`),
        isBatchCatalogue,
        totalOffersCount: pendingOffers.length,
        version,
        fileHash,
        originalFileName,
        filePath,
        fileSize,
        rawText,
        wordCount,
        totalRagTokens,
        gatekeeperScore: gatekeeperResult.confidenceScore,
        gatekeeperStatus: 'APPROVED',
        gatekeeperReasoning: gatekeeperResult.reasoning,
        status: 'INDEXING',
        uploadedBy: user?._id || null
      });

      // 6. Asynchronously index into Qdrant Vector Store
      setImmediate(async () => {
        try {
          let indexedOfferCount = 0;
          if (isBatchCatalogue && pendingOffers.length > 0) {
            // Assign parent document ID to all extracted offers
            pendingOffers.forEach((o) => { o.parentDocumentId = policyDoc._id; });
            const savedOffers = await policyOfferService.persistAndIndexOffers(
              pendingOffers,
              policyDoc,
              (progress) => {
                if (uploadId) {
                  uploadProgressTracker.set(uploadId, {
                    ...progress,
                    documentId: policyDoc._id,
                    status: 'INDEXING'
                  });
                }
              }
            );
            indexedOfferCount = savedOffers.length;
          }

          const chunks = await indexPolicyDocument(policyDoc, (progress) => {
            if (uploadId && !isBatchCatalogue) {
              uploadProgressTracker.set(uploadId, {
                ...progress,
                documentId: policyDoc._id,
                status: 'INDEXING'
              });
            }
          });

          policyDoc.chunkCount = chunks.length + indexedOfferCount;
          policyDoc.status = 'INDEXED';
          await policyDoc.save();

          if (uploadId) {
            const successMsg = isBatchCatalogue
              ? `Indexed ${indexedOfferCount} individual policy offers & ${chunks.length} clauses into Qdrant.`
              : `Indexed ${chunks.length} clauses into Qdrant successfully.`;
            uploadProgressTracker.set(uploadId, {
              percent: 100,
              stage: 'completed',
              message: successMsg,
              status: 'READY',
              documentId: policyDoc._id
            });
            setTimeout(() => uploadProgressTracker.delete(uploadId), 120 * 1000);
          }
        } catch (idxErr) {
          policyDoc.status = 'FAILED';
          await policyDoc.save();
          if (uploadId) {
            uploadProgressTracker.set(uploadId, {
              percent: 0,
              stage: 'error',
              message: `Indexing failed: ${idxErr.message}`,
              status: 'FAILED'
            });
          }
        }
      });

      return {
        document: policyDoc,
        gatekeeper: gatekeeperResult
      };
    } catch (err) {
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
      throw err;
    }
  }

  /**
   * Get live progress of an ongoing document upload
   */
  getUploadProgress(uploadId) {
    return (
      uploadProgressTracker.get(uploadId) || {
        percent: 0,
        stage: 'idle',
        message: 'No active upload detected.',
        status: 'PENDING'
      }
    );
  }

  /**
   * List all indexed policy documents with aggregate statistics
   */
  async listPolicyDocuments(queryParams = {}) {
    const { policyType, status, search } = queryParams;
    const query = {};

    if (policyType) query.policyType = policyType;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { policyCode: { $regex: search, $options: 'i' } },
        { originalFileName: { $regex: search, $options: 'i' } }
      ];
    }

    const documents = await PolicyDocument.find(query).select('-chunks -rawText').sort({ createdAt: -1 });

    const totalWordCount = documents.reduce((acc, d) => acc + (d.wordCount || 0), 0);
    const totalChunks = documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0);
    const totalRagTokens = documents.reduce((acc, d) => acc + (d.totalRagTokens || 0), 0);

    return {
      documents,
      totalDocuments: documents.length,
      stats: {
        totalWordCount,
        totalChunks,
        totalRagTokens
      }
    };
  }

  /**
   * Get single policy document details
   */
  async getPolicyDocumentById(id) {
    const doc = await PolicyDocument.findById(id).select('-chunks.vector');
    if (!doc) {
      throw ApiError.notFound('Policy document not found');
    }
    return doc;
  }

  /**
   * Get semantic chunks for a policy document (from MongoDB chunks, Qdrant, or parsed)
   */
  async getPolicyDocumentChunks(id) {
    const doc = await PolicyDocument.findById(id).select('-chunks.vector');
    if (!doc) {
      throw ApiError.notFound('Policy document not found');
    }

    // 1. Return chunks stored directly in MongoDB on PolicyDocument
    if (Array.isArray(doc.chunks) && doc.chunks.length > 0) {
      return doc.chunks;
    }

    // 2. Try Qdrant points
    const points = await getChunksByDocumentId(id);
    if (points && points.length > 0) {
      return points.map((p) => p.payload || p);
    }

    // 3. Fallback: Parse chunks from rawText
    return splitInsurancePolicyIntoSemanticChunks(doc.rawText, {
      title: doc.title,
      policyType: doc.policyType,
      policyCode: doc.policyCode
    });
  }

  /**
   * Delete policy document from MongoDB, Qdrant vectors, disk storage, and prompt cache
   */
  async deletePolicyDocument(id) {
    const doc = await PolicyDocument.findById(id);
    if (!doc) {
      throw ApiError.notFound('Policy document not found');
    }

    // 1. Gather all vector point IDs: chunk point IDs + child offer point IDs
    const chunkPointIds = Array.isArray(doc.chunks)
      ? doc.chunks.map((c) => c.chunkId).filter(Boolean)
      : [];

    let childPointIds = [];
    try {
      const childOffers = await PolicyOffer.find({ parentDocumentId: id }).select('qdrantPointId');
      childPointIds = childOffers.map((o) => o.qdrantPointId).filter(Boolean);
    } catch (_) {}

    const allPointIds = [...new Set([...chunkPointIds, ...childPointIds])];

    // 2. Delete all vectors associated with documentId in Qdrant via filter
    await deleteVectorsByDocumentId(id);

    // 3. Extra safeguard: Delete vector points directly by ID
    if (allPointIds.length > 0) {
      try {
        await deletePointsByIds(allPointIds);
      } catch (err) {
        console.warn(`⚠️ Warning deleting Qdrant points by ID for doc ${id}:`, err.message);
      }
    }

    // 4. Cascade delete child policy offers from MongoDB
    const deletedOffers = await PolicyOffer.deleteMany({ parentDocumentId: id });

    // 5. Delete physical file from disk storage
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try { fs.unlinkSync(doc.filePath); } catch (_) {}
    }

    // 6. Delete master PolicyDocument record from MongoDB
    await PolicyDocument.findByIdAndDelete(id);

    console.log(`✅ Successfully removed document '${doc.title}' (${id}): Qdrant vectors purged and ${deletedOffers.deletedCount || 0} offers deleted.`);

    return {
      _id: id,
      title: doc.title,
      deletedChunksCount: chunkPointIds.length,
      deletedOffersCount: deletedOffers.deletedCount || 0
    };
  }
}

export const policyDocumentService = new PolicyDocumentService();
