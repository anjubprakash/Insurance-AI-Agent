import crypto from 'crypto';
import { getEmbeddingModel } from './aiProvider.service.js';
import {
  getQdrantClient,
  upsertRuleVectors,
  searchRuleVectors,
  getStoredVectorCount
} from './qdrant.service.js';
import { splitInsurancePolicyIntoSemanticChunks } from './insuranceParser.service.js';
import { PolicyDocument } from '../models/policyDocument.model.js';
import { PolicyOffer } from '../models/policyOffer.model.js';
import { formatPolicyOfferText } from './policyOffer.service.js';
import { env } from '../config/env.js';

// Compute Cosine Similarity between two dense 384-dimensional vectors
export const cosineSimilarity = (vecA = [], vecB = []) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] || 0;
    const b = vecB[i] || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
};

const matchesCategoryFilter = (itemCategory = '', filterCategory = null) => {
  if (!filterCategory) return true;
  return String(itemCategory).toUpperCase().trim() === String(filterCategory).toUpperCase().trim();
};

// Index Insurance Policy Document chunks into Qdrant Vector Store & MongoDB with Structure Awareness
export const indexPolicyDocument = async (document, onProgress = null) => {
  const rawText = document.rawText;
  if (!rawText) return [];

  // 1. Split document using Insurance Policy Structure-Aware Chunking
  const parsedChunks = splitInsurancePolicyIntoSemanticChunks(rawText, {
    title: document.title || '',
    policyType: document.policyType || 'AUTO',
    policyCode: document.policyCode || ''
  });

  if (parsedChunks.length === 0) return [];

  console.log(`📦 [${document.title}] Generated ${parsedChunks.length} cohesive semantic chunks. Starting embedding & indexing into Qdrant...`);

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'parsing',
      percent: 25,
      processed: 0,
      totalChunks: parsedChunks.length,
      currentBatch: 0,
      totalBatches: Math.ceil(parsedChunks.length / 32),
      batchPercent: 0,
      message: `Generated ${parsedChunks.length} semantic chunks. Starting embeddings...`
    });
  }

  const embeddingModel = getEmbeddingModel();
  const allPoints = [];
  const dbChunks = [];
  const BATCH_SIZE = 32; // Optimal batch size for local all-MiniLM-L6-v2 ONNX CPU inference
  const totalBatches = Math.ceil(parsedChunks.length / BATCH_SIZE);

  // 2. Batch embedding generation, formulation, and live Qdrant streaming
  for (let i = 0; i < parsedChunks.length; i += BATCH_SIZE) {
    const batch = parsedChunks.slice(i, i + BATCH_SIZE);
    const batchTexts = batch.map((c) => c.content);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const processed = Math.min(i + batch.length, parsedChunks.length);
    const pct = Math.round((processed / parsedChunks.length) * 100);

    console.log(`⚡ [${document.title}] Embedding batch ${batchNum}/${totalBatches} (${processed}/${parsedChunks.length} chunks - ${pct}%)...`);

    if (typeof onProgress === 'function') {
      const overallPercent = 25 + Math.round((processed / parsedChunks.length) * 70);
      onProgress({
        stage: 'embedding',
        percent: Math.min(overallPercent, 96),
        processed,
        totalChunks: parsedChunks.length,
        currentBatch: batchNum,
        totalBatches,
        batchPercent: pct,
        message: `Embedding batch ${batchNum}/${totalBatches} (${processed}/${parsedChunks.length} chunks - ${pct}%)...`
      });
    }

    const batchEmbeddings = await embeddingModel.embedDocuments(batchTexts);

    const batchPoints = batch.map((chunk, bIdx) => {
      const globalIdx = i + bIdx;
      const idHash = crypto.createHash('md5').update(`${document._id}_chunk_${globalIdx}`).digest('hex');
      const pointId = `${idHash.slice(0, 8)}-${idHash.slice(8, 12)}-${idHash.slice(12, 16)}-${idHash.slice(16, 20)}-${idHash.slice(20, 32)}`;
      const vector = batchEmbeddings[bIdx] || [];

      dbChunks.push({
        chunkId: pointId,
        chunkIndex: globalIdx,
        sectionTitle: chunk.sectionTitle || '',
        clauseCode: chunk.clauseCode || document.policyCode || '',
        clauseType: chunk.clauseType || 'Coverage Term',
        isExclusion: Boolean(chunk.isExclusion),
        isSchedule: Boolean(chunk.isSchedule),
        isExcess: Boolean(chunk.isExcess),
        isFnolRule: Boolean(chunk.isFnolRule),
        content: chunk.content,
        vector
      });

      return {
        id: pointId,
        vector,
        payload: {
          documentId: document._id.toString(),
          title: document.title || '',
          policyType: document.policyType || 'AUTO',
          policyCode: chunk.clauseCode || document.policyCode || '',
          sectionTitle: chunk.sectionTitle || '',
          clauseType: chunk.clauseType || 'Coverage Term',
          isExclusion: Boolean(chunk.isExclusion),
          isSchedule: Boolean(chunk.isSchedule),
          isExcess: Boolean(chunk.isExcess),
          isFnolRule: Boolean(chunk.isFnolRule),
          version: document.version || '1.0',
          chunkIndex: globalIdx,
          content: chunk.content
        }
      };
    });

    try {
      await upsertRuleVectors(batchPoints);
    } catch (qErr) {
      console.warn(`⚠️ Qdrant batch upsert notice (saving vectors to MongoDB): ${qErr.message}`);
    }

    allPoints.push(...batchPoints);
    await new Promise((resolve) => setImmediate(resolve));
  }

  // 3. Save embedded chunks directly inside MongoDB PolicyDocument
  document.chunks = dbChunks;
  await document.save();

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'completed',
      percent: 100,
      processed: allPoints.length,
      totalChunks: allPoints.length,
      currentBatch: totalBatches,
      totalBatches,
      batchPercent: 100,
      message: `Successfully indexed all ${allPoints.length} semantic chunks!`
    });
  }

  console.log(`✅ [${document.title}] Successfully indexed all ${allPoints.length} semantic chunks.`);
  return allPoints;
};

// Search MongoDB stored vectors (PolicyDocument.chunks and PolicyOffer) using Cosine Similarity
export const searchMongoDBVectors = async (queryVector, limit = 20, filter = null) => {
  const filterCategory = filter?.policyType || null;
  const results = [];

  try {
    const docs = await PolicyDocument.find({
      status: 'INDEXED',
      isBatchCatalogue: { $ne: true }
    }).select('title policyType policyCode version chunks');

    for (const doc of docs) {
      if (filterCategory && doc.policyType !== 'MULTIPLE' && !matchesCategoryFilter(doc.policyType, filterCategory)) {
        continue;
      }

      for (const ch of doc.chunks || []) {
        const score = cosineSimilarity(queryVector, ch.vector);
        results.push({
          id: ch.chunkId || `${doc._id}_chunk_${ch.chunkIndex}`,
          score,
          payload: {
            documentId: doc._id.toString(),
            title: doc.title || '',
            policyType: doc.policyType,
            policyCode: ch.clauseCode || doc.policyCode || '',
            sectionTitle: ch.sectionTitle || 'Policy Clause',
            clauseType: ch.clauseType || 'Coverage Term',
            version: doc.version || '1.0',
            content: ch.content
          }
        });
      }
    }

    const offers = await PolicyOffer.find({ status: 'ACTIVE' });
    for (const offer of offers) {
      if (filterCategory && !matchesCategoryFilter(offer.policyCategory, filterCategory)) {
        continue;
      }

      const textContent = offer.chunkText || formatPolicyOfferText(offer);
      const score = cosineSimilarity(queryVector, offer.vector);

      results.push({
        id: offer.qdrantPointId || `offer_${offer._id}`,
        score,
        payload: {
          documentId: offer.parentDocumentId?.toString() || '',
          policyOfferId: offer._id.toString(),
          title: `${offer.planName} (${offer.insurer})`,
          planName: offer.planName,
          insurer: offer.insurer,
          policyType: offer.policyCategory || 'GENERAL',
          policyCode: offer.policyReferenceCode || '',
          policyReferenceCode: offer.policyReferenceCode || '',
          sectionTitle: `${offer.policyCategory} Plan • ${offer.coverageSubtype || 'Standard'}`,
          clauseType: 'Policy Offer Schedule',
          minimumEntryAge: offer.minimumEntryAge ?? 18,
          maximumEntryAge: offer.maximumEntryAge ?? 75,
          annualCoverageAmount: offer.annualCoverageAmount,
          illustrativePremium: offer.illustrativePremium,
          excessDeductible: offer.excessDeductible,
          benefitSublimits: offer.benefitSublimits,
          waitingPeriods: offer.waitingPeriods,
          preExistingConditionRules: offer.preExistingConditionRules,
          risksConsidered: offer.risksConsidered,
          exclusions: offer.exclusions,
          claimsProcess: offer.claimsProcess,
          isIndividualPolicyOffer: true,
          content: textContent
        }
      });
    }
  } catch (err) {
    console.warn('⚠️ MongoDB vector search notice:', err.message);
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
};

// Search Qdrant & MongoDB knowledge base for relevant insurance policy clauses & offers with hybrid scoring
export const searchSimilarPolicyClauses = async (queryText, limit = 6, filter = null) => {
  if (!queryText || !queryText.trim()) return [];

  // 1. Perform Semantic Vector Search across Qdrant and MongoDB
  let semanticResults = [];
  try {
    const embeddingModel = getEmbeddingModel();
    if (embeddingModel) {
      const queryVector = await embeddingModel.embedQuery(queryText);
      const candidateLimit = Math.max(limit * 10, 50);

      try {
        const qdrantCount = await getStoredVectorCount();
        if (qdrantCount > 0) {
          const qdrantHits = await searchRuleVectors(queryVector, candidateLimit, filter);
          semanticResults.push(...qdrantHits);
        }
      } catch (qErr) {
        console.warn('⚠️ Qdrant vector search notice (using MongoDB vectors):', qErr.message);
      }

      const mongoHits = await searchMongoDBVectors(queryVector, candidateLimit, filter);
      for (const hit of mongoHits) {
        if (!semanticResults.some((ex) => ex.id === hit.id)) {
          semanticResults.push(hit);
        } else {
          // Enrich Qdrant payload with full MongoDB offer fields (such as min/max entry age)
          const idx = semanticResults.findIndex((ex) => ex.id === hit.id);
          if (idx !== -1) {
            semanticResults[idx].payload = { ...hit.payload, ...semanticResults[idx].payload };
          }
        }
      }
    }
  } catch (vecErr) {
    console.warn('⚠️ Vector search encounter error:', vecErr.message);
  }

  if (semanticResults.length === 0) return [];

  // 2. Extract policy code patterns (e.g. INS001, POL-HLTH-001) & category terms
  const qLower = queryText.toLowerCase();
  const codePattern = /\b(?:INS\s*0*[0-9]{1,3}|POL-[A-Z0-9-]+)\b/gi;
  const rawCodeMatches = (queryText.match(codePattern) || []).map((c) => c.toLowerCase().replace(/\s+/g, ''));

  // Detect category intent from query text
  const detectedCategories = new Set();
  if (filter?.policyType && filter.policyType !== 'ALL') {
    detectedCategories.add(String(filter.policyType).toUpperCase().trim());
  }
  if (/\b(health|medical|hospital|doctor|surgery|diabetes|asthma|hypertension|cancer|dental|maternity|senior\s+care)\b/i.test(qLower)) {
    detectedCategories.add('HEALTH');
  }
  if (/\b(auto|car|motor|vehicle|driver|driving|collision|roadside|windscreen)\b/i.test(qLower)) {
    detectedCategories.add('AUTO');
  }
  if (/\b(home|house|property|building|contents|flood|fire|burglary|theft|tenant|landlord)\b/i.test(qLower)) {
    detectedCategories.add('HOME');
  }
  if (/\b(life|term\s+life|mortality|death\s+benefit|beneficiary|endowment)\b/i.test(qLower)) {
    detectedCategories.add('LIFE');
  }
  if (/\b(accident|injury|disability|fracture|personal\s+accident)\b/i.test(qLower)) {
    detectedCategories.add('ACCIDENT');
  }
  if (/\b(agriculture|farm|crop|livestock|cattle|drought|tractor)\b/i.test(qLower)) {
    detectedCategories.add('AGRICULTURE');
  }
  if (/\b(commercial|business|liability|employer|cyber|warehouse|partner|partnership|enterprise|company|venture|shop|office|corporate|startup)\b/i.test(qLower)) {
    detectedCategories.add('COMMERCIAL');
  }
  if (/\b(travel|flight|trip|abroad|overseas|vacation|holiday|luggage)\b/i.test(qLower)) {
    detectedCategories.add('TRAVEL');
  }

  // Detect age mentioned in query (e.g., "64", "age 64", "64 years old")
  let detectedAge = null;
  const ageMatch = queryText.match(/\b(?:age(?:d)?\s*[:is]*\s*(\d{1,2})|(\d{1,2})\s*(?:years?\s*old|yrs?\b|y\/o))\b/i) ||
                   queryText.match(/\b(1[89]|[2-8][0-9]|90)\b/);
  if (ageMatch) {
    const parsedAge = Number(ageMatch[1] || ageMatch[2] || ageMatch[0]);
    if (parsedAge >= 1 && parsedAge <= 100) {
      detectedAge = parsedAge;
    }
  }

  const stem = (w) => w.toLowerCase().replace(/(ing|tion|tions|ers|ed|es|s)$/g, '');
  const stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
    'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
    'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
    'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
    'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'if', 'in', 'into',
    'is', 'it', 'its', 'itself', 'just', 'may', 'me', 'might', 'more', 'most',
    'must', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once',
    'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own', 'same', 'shall',
    'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
    'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
    'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
    'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours',
    'insurance', 'policy', 'plan', 'looking', 'want', 'need'
  ]);

  const queryTokens = qLower
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // 3. Score candidates with hybrid weighting
  const scored = semanticResults.map((item) => {
    const payload = item.payload || {};
    const content = (payload.content || '').toLowerCase();
    const policyCode = (payload.policyCode || payload.policyReferenceCode || '').toLowerCase();
    const policyCodeNorm = norm(policyCode);
    const docTitle = (payload.title || payload.planName || '').toLowerCase();
    const itemCategory = (payload.policyType || payload.policyCategory || '').toUpperCase();
    const fullText = `${content} ${policyCode} ${docTitle} ${itemCategory.toLowerCase()}`;

    let hybridScore = item.score || 0;
    let hasExactCodeMatch = false;
    let hasCategoryMatch = false;

    // Exact policy code match boost (e.g. INS002)
    for (const rc of rawCodeMatches) {
      const rcNorm = norm(rc);
      if (policyCodeNorm === rcNorm || (rcNorm.length >= 4 && policyCodeNorm.includes(rcNorm))) {
        hybridScore += 15.0;
        hasExactCodeMatch = true;
      }
    }

    // Exact plan name match boost
    if (payload.planName && qLower.includes(payload.planName.toLowerCase())) {
      hybridScore += 12.0;
      hasExactCodeMatch = true;
    }

    // Category match boost / mismatch demotion
    if (detectedCategories.size > 0) {
      if (detectedCategories.has(itemCategory)) {
        hybridScore += 3.0;
        hasCategoryMatch = true;
      } else {
        hybridScore -= 2.5;
      }
    }

    // Age eligibility boost if an age is present in the query
    if (detectedAge !== null && (payload.minimumEntryAge !== undefined || payload.maximumEntryAge !== undefined)) {
      const minAge = payload.minimumEntryAge ?? 18;
      const maxAge = payload.maximumEntryAge ?? 75;
      if (detectedAge >= minAge && detectedAge <= maxAge) {
        hybridScore += 2.0;
      } else {
        hybridScore -= 3.0;
      }
    }

    // Keyword stem matching
    let keywordHits = 0;
    const itemWords = fullText.split(/[^a-z0-9]+/).map(stem);
    for (const token of queryTokens) {
      const tokenStem = stem(token);
      if (itemWords.includes(tokenStem) || itemWords.includes(token)) {
        keywordHits += 1;
      }
    }

    if (queryTokens.length > 0) {
      hybridScore += (keywordHits / queryTokens.length) * 1.5;
    }

    return {
      ...item,
      hybridScore,
      hasExactCodeMatch,
      hasCategoryMatch,
      keywordHits
    };
  });

  scored.sort((a, b) => b.hybridScore - a.hybridScore);

  // 4. Deduplicate identical chunks by ID or substantive body content
  const seenIds = new Set();
  const seenBody = new Set();
  const deduplicated = [];

  for (const c of scored) {
    if (seenIds.has(c.id)) continue;
    seenIds.add(c.id);

    const substantiveBody = (c.payload?.content || '')
      .replace(/^(\[[^\]]+\]\s*)+/g, '')
      .slice(0, 150)
      .trim();

    if (!seenBody.has(substantiveBody)) {
      seenBody.add(substantiveBody);
      deduplicated.push(c);
    }
  }

  return deduplicated.slice(0, limit);
};

// Retrieve all chunks for a specific policy document from MongoDB or Qdrant
export const getChunksByDocumentId = async (documentId, limit = 100) => {
  if (!documentId) return [];

  try {
    const doc = await PolicyDocument.findById(documentId).select('chunks title policyType policyCode');
    if (doc && Array.isArray(doc.chunks) && doc.chunks.length > 0) {
      return doc.chunks.slice(0, limit).map((ch) => ({
        id: ch.chunkId,
        payload: {
          documentId: doc._id.toString(),
          title: doc.title,
          policyType: doc.policyType,
          policyCode: ch.clauseCode || doc.policyCode,
          sectionTitle: ch.sectionTitle,
          clauseType: ch.clauseType,
          chunkIndex: ch.chunkIndex,
          content: ch.content
        }
      }));
    }
  } catch (_) {}

  try {
    const qdrant = getQdrantClient();
    const res = await qdrant.scroll(env.QDRANT_COLLECTION_NAME, {
      filter: {
        must: [{ key: 'documentId', match: { value: documentId.toString() } }]
      },
      limit,
      with_payload: true
    });
    return res?.points || [];
  } catch (_) {
    return [];
  }
};
