import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../config/env.js';

let client = null;

export const getEmbeddingDimension = () => 384;

// Validate that vector is a 384-dim float array
export const ensureValidVector = (vec, dim = getEmbeddingDimension()) => {
  if (Array.isArray(vec) && vec.length === dim) {
    return vec;
  }
  throw new Error(`Invalid vector dimension: expected ${dim}`);
};

export const getQdrantClient = () => {
  if (!client) {
    client = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY || undefined,
      checkCompatibility: false
    });
  }
  return client;
};

// Initialize Qdrant collection for Insurance policy rules
export const initQdrantCollection = async () => {
  const targetDim = getEmbeddingDimension();
  const qdrant = getQdrantClient();
  const collectionName = env.QDRANT_COLLECTION_NAME;

  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);

    if (!exists) {
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: targetDim,
          distance: 'Cosine'
        }
      });
      console.log(`✅ Qdrant Collection '${collectionName}' created (${targetDim} dims for Insurance Policies).`);
    } else {
      console.log(`✅ Qdrant Collection '${collectionName}' is ready (${targetDim} dims).`);
    }
    return true;
  } catch (error) {
    console.warn(`⚠️ Qdrant Vector Engine is currently unreachable at ${env.QDRANT_URL}: ${error.message}`);
    return false;
  }
};

// Upsert vectors into Qdrant in batches
export const upsertRuleVectors = async (points) => {
  if (!points || points.length === 0) return 0;

  const qdrant = getQdrantClient();
  const collectionName = env.QDRANT_COLLECTION_NAME;

  const sanitizedPoints = points.map((p) => ({
    id: p.id,
    vector: ensureValidVector(p.vector),
    payload: p.payload
  }));

  const BATCH_SIZE = 50;
  for (let i = 0; i < sanitizedPoints.length; i += BATCH_SIZE) {
    const batch = sanitizedPoints.slice(i, i + BATCH_SIZE);
    try {
      await qdrant.upsert(collectionName, {
        wait: true,
        points: batch
      });
    } catch (err) {
      const errorMsg = `Qdrant vector upsert notice: ${err.message}`;
      console.warn(`⚠️ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  return sanitizedPoints.length;
};


// Semantic vector search directly in Qdrant
export const searchRuleVectors = async (queryVector, limit = 5, filter = null) => {
  const qdrant = getQdrantClient();
  const collectionName = env.QDRANT_COLLECTION_NAME;
  const validQueryVec = ensureValidVector(queryVector);

  // Convert simple { policyType: '...' } into valid Qdrant filter structure
  let qdrantFilter = null;
  if (filter) {
    if (filter.must || filter.should) {
      qdrantFilter = filter;
    } else if (filter.policyType) {
      const pt = String(filter.policyType).toUpperCase().trim();
      if (pt === 'ACCIDENT') {
        qdrantFilter = {
          should: [
            { key: 'policyType', match: { value: 'ACCIDENT' } },
            { key: 'policyType', match: { value: 'AGRICULTURE' } }
          ]
        };
      } else {
        qdrantFilter = {
          must: [{ key: 'policyType', match: { value: pt } }]
        };
      }
    }
  }

  try {
    let rawPoints = [];
    const queryParams = {
      vector: validQueryVec,
      limit,
      with_payload: true
    };
    if (qdrantFilter) queryParams.filter = qdrantFilter;

    if (typeof qdrant.search === 'function') {
      rawPoints = (await qdrant.search(collectionName, queryParams)) || [];
    } else if (typeof qdrant.query === 'function') {
      const res = await qdrant.query(collectionName, {
        query: validQueryVec,
        limit,
        with_payload: true,
        filter: qdrantFilter || undefined
      });
      rawPoints = res?.points || [];
    }

    return (rawPoints || []).map((res) => ({
      id: res.id,
      score: res.score,
      payload: res.payload
    }));
  } catch (err) {
    console.warn(`⚠️ Qdrant search notice: ${err.message}`);
    return [];
  }
};

// Get total count of stored vectors in the main insurance collection
export const getStoredVectorCount = async () => {
  const qdrant = getQdrantClient();
  const collectionName = env.QDRANT_COLLECTION_NAME;

  try {
    const info = await qdrant.getCollection(collectionName);
    return info?.points_count || info?.vectors_count || 0;
  } catch (err) {
    return 0;
  }
};

// Delete all vectors associated with a specific policy document
export const deleteVectorsByDocumentId = async (docId) => {
  if (!docId) return;
  const strId = String(docId);
  const collectionName = env.QDRANT_COLLECTION_NAME;
  const qdrant = getQdrantClient();

  try {
    await qdrant.delete(collectionName, {
      filter: {
        must: [
          {
            key: 'documentId',
            match: { value: strId }
          }
        ]
      }
    });
    console.log(`🗑️ Deleted Qdrant vectors for documentId: ${strId}`);
  } catch (err) {
    console.warn(`⚠️ Qdrant vector deletion notice for doc ${strId}:`, err.message);
  }
};

// Delete specific vector points by their IDs
export const deletePointsByIds = async (pointIds = []) => {
  if (!pointIds || pointIds.length === 0) return;
  const collectionName = env.QDRANT_COLLECTION_NAME;
  const qdrant = getQdrantClient();

  try {
    await qdrant.delete(collectionName, {
      points: Array.isArray(pointIds) ? pointIds : [pointIds]
    });
    console.log(`🗑️ Deleted Qdrant vector point(s): ${pointIds}`);
  } catch (err) {
    console.warn(`⚠️ Qdrant vector point deletion notice:`, err.message);
  }
};

// Delete all vectors associated with a specific policy offer
export const deleteVectorsByOfferId = async (offerId, policyCode = null) => {
  if (!offerId && !policyCode) return;
  const collectionName = env.QDRANT_COLLECTION_NAME;
  const qdrant = getQdrantClient();

  const shouldConditions = [];
  if (offerId) {
    shouldConditions.push({ key: 'policyOfferId', match: { value: String(offerId) } });
  }
  if (policyCode) {
    shouldConditions.push({ key: 'policyReferenceCode', match: { value: String(policyCode) } });
    shouldConditions.push({ key: 'policyCode', match: { value: String(policyCode) } });
  }

  try {
    await qdrant.delete(collectionName, {
      filter: {
        should: shouldConditions
      }
    });
    console.log(`🗑️ Deleted Qdrant vectors for offerId: ${offerId}, code: ${policyCode}`);
  } catch (err) {
    console.warn(`⚠️ Qdrant vector deletion notice for offer:`, err.message);
  }
};

// -------------------------------------------------------------

