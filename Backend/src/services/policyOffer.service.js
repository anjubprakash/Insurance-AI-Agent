import crypto from 'crypto';
import { createRequire } from 'module';
import { PolicyOffer } from '../models/policyOffer.model.js';
import { PolicyDocument } from '../models/policyDocument.model.js';
import { getEmbeddingModel } from './aiProvider.service.js';
import { upsertPoints, deletePointsByIds, deleteVectorsByOfferId } from './qdrant.service.js';
import { ApiError } from '../utils/apiError.js';

// Use createRequire for CommonJS packages in Node.js ESM modules
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

/**
 * Deterministically convert an arbitrary string ID into a RFC4122 v4-compliant UUID
 * Qdrant requires vector point IDs to be valid UUIDs or positive integers
 */
export const generateDeterministicUUID = (inputString) => {
  const hash = crypto.createHash('md5').update(inputString).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16), // Version 4 UUID
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20), // Variant 1
    hash.substring(20, 32)
  ].join('-');
};

/**
 * Standardize policy category string to match Mongoose enum values
 */
export const normalizePolicyCategory = (rawCategory) => {
  if (!rawCategory) return 'GENERAL';
  const clean = String(rawCategory).toUpperCase().trim();

  if (clean.includes('HEALTH') || clean.includes('MEDICAL')) return 'HEALTH';
  if (clean.includes('AUTO') || clean.includes('MOTOR') || clean.includes('CAR') || clean.includes('VEHICLE')) return 'AUTO';
  if (clean.includes('HOME') || clean.includes('PROPERTY') || clean.includes('BUILDING')) return 'HOME';
  if (clean.includes('LIFE') || clean.includes('ANNUITY')) return 'LIFE';
  if (clean.includes('ACCIDENT')) return 'ACCIDENT';
  if (clean.includes('AGRICULTURE') || clean.includes('CROP') || clean.includes('FARM')) return 'AGRICULTURE';
  if (clean.includes('COMMERCIAL') || clean.includes('BUSINESS')) return 'COMMERCIAL';
  if (clean.includes('TRAVEL')) return 'TRAVEL';
  if (clean.includes('LIABILITY')) return 'LIABILITY';

  return 'GENERAL';
};

/**
 * Generate a short, standard category prefix for auto-generating policy codes
 * Example: HEALTH -> HLTH, AUTO -> MOT, HOME -> HOM, LIFE -> LIFE
 */
export const getCategoryPrefix = (category) => {
  switch (category) {
    case 'HEALTH': return 'HLTH';
    case 'AUTO': return 'MOT';
    case 'HOME': return 'HOM';
    case 'LIFE': return 'LIFE';
    case 'ACCIDENT': return 'ACC';
    case 'AGRICULTURE': return 'AGR';
    case 'COMMERCIAL': return 'COMM';
    case 'TRAVEL': return 'TRV';
    case 'LIABILITY': return 'LIAB';
    default: return 'POL';
  }
};

/**
 * Format a PolicyOffer into a dense, semantically rich text block
 * This text is vectorized into Qdrant for RAG agent question-answering
 */
export const formatPolicyOfferText = (offer) => {
  return [
    `[INSURANCE POLICY OFFER: ${offer.policyReferenceCode}]`,
    `Plan Name: ${offer.planName}`,
    `Insurer: ${offer.insurer}`,
    `Policy Category: ${offer.policyCategory} (${offer.coverageSubtype || 'Standard Coverage'})`,
    offer.annualCoverageAmount ? `Annual Coverage Limit: ${offer.annualCoverageAmount}` : null,
    offer.excessDeductible ? `Excess / Deductible: ${offer.excessDeductible}` : null,
    offer.illustrativePremium ? `Illustrative Premium: ${offer.illustrativePremium} (${offer.premiumBasis || 'Illustrative'})` : null,
    offer.benefitSublimits ? `Benefit Sub-limits: ${offer.benefitSublimits}` : null,
    offer.minimumEntryAge || offer.maximumEntryAge ? `Eligibility Age: ${offer.minimumEntryAge || 18} to ${offer.maximumEntryAge || 70} years` : null,
    offer.waitingPeriods ? `Waiting Periods: ${offer.waitingPeriods}` : null,
    offer.preExistingConditionRules ? `Pre-existing Condition Rules: ${offer.preExistingConditionRules}` : null,
    offer.exclusions ? `Exclusions / Limitations: ${offer.exclusions}` : null,
    offer.risksConsidered ? `Risks / Conditions Considered: ${offer.risksConsidered}` : null,
    offer.claimsProcess ? `Claims & FNOL Process: ${offer.claimsProcess}` : null
  ]
    .filter(Boolean)
    .join('\n');
};

class PolicyOfferService {
  /**
   * Parse an Excel workbook and extract structured individual policy offers
   * Supports workbooks like '30_fictional_insurance_offers.xlsx'
   */
  extractOffersFromWorkbook(filePath, parentDocumentId, docSeed = 'BATCH') {
    const workbook = XLSX.readFile(filePath);
    const extractedOffers = [];

    // Iterate through all sheets in the uploaded workbook
    for (const sheetName of workbook.SheetNames) {
      // Skip meta-sheets like Readme or Changelog if recognized
      const lowerSheet = sheetName.toLowerCase().trim();
      if (lowerSheet.includes('read me') || lowerSheet.includes('readme') || lowerSheet.includes('category summary')) {
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // Parse sheet rows as raw JSON objects
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (!rawRows || rawRows.length === 0) continue;

      let rowIndex = 0;
      for (const row of rawRows) {
        rowIndex++;

        // Helper to find a value across various common column name synonyms
        const getCol = (...synonyms) => {
          for (const syn of synonyms) {
            const lowerSyn = syn.toLowerCase();
            for (const key of Object.keys(row)) {
              if (key.toLowerCase().trim() === lowerSyn) {
                const val = row[key];
                return val !== undefined && val !== null ? String(val).trim() : '';
              }
            }
          }
          return '';
        };

        // Extract key attributes
        const offerId = getCol('Offer ID', 'Policy ID', 'Policy Code', 'Policy Number', 'Plan ID', 'Code', 'ID');
        const planName = getCol('Offer / Plan Name', 'Plan Name', 'Product Name', 'Policy Name', 'Plan', 'Title');
        const insurer = getCol('Fictional Insurer', 'Insurer', 'Insurance Company', 'Carrier', 'Provider', 'Company') || 'General Insurer';
        const rawCategory = getCol('Insurance Type', 'Policy Category', 'Type', 'Category', 'Line of Business');
        const coverageSubtype = getCol('Coverage Subtype', 'Subtype', 'Plan Type', 'Coverage');
        const annualCoverageAmount = getCol('Annual / Maximum Coverage Amount (£)', 'Annual Limit', 'Coverage Limit', 'Sum Insured', 'Coverage Amount');
        const benefitSublimits = getCol('Benefit Sub-limits', 'Sub-limits', 'Sublimits', 'Benefits');
        const illustrativePremium = getCol('Illustrative Premium', 'Premium', 'Monthly Premium', 'Cost');
        const premiumBasis = getCol('Premium Basis / Assumptions', 'Premium Basis', 'Assumptions');
        const risksConsidered = getCol('Health Conditions / Risks Considered', 'Risks Considered', 'Conditions Covered');
        const preExistingConditionRules = getCol('Pre-existing Condition Rules', 'Pre-existing Conditions', 'Pre-existing');
        const waitingPeriods = getCol('Waiting Periods', 'Waiting Period');
        const exclusions = getCol('Exclusions / Limitations', 'Exclusions', 'Limitations', 'Not Covered');
        const excessDeductible = getCol('Excess / Deductible', 'Deductible', 'Excess', 'Copay');
        const claimsProcess = getCol('Claims Process', 'FNOL Process', 'Claims');

        // Only process rows that have at least a plan name or offer ID
        if (!planName && !offerId) continue;

        // Determine category
        const category = normalizePolicyCategory(rawCategory);
        const categoryPrefix = getCategoryPrefix(category);

        // Standardized Policy Reference Code:
        // 1. If provided in the spreadsheet (e.g. INS001), use and clean it
        // 2. If NOT provided, auto-generate standard enterprise code: POL-[CATEGORY]-[ROW_NUM]-[DOC_SEED]
        const policyReferenceCode = offerId
          ? offerId.toUpperCase().replace(/\s+/g, '-')
          : `POL-${categoryPrefix}-${String(rowIndex).padStart(3, '0')}-${docSeed}`;

        // Collect remaining unrecognized columns in metadata
        const metadata = new Map();
        for (const [key, val] of Object.entries(row)) {
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            metadata.set(key, String(val).trim());
          }
        }

        extractedOffers.push({
          parentDocumentId,
          policyReferenceCode,
          planName: planName || `Insurance Plan ${policyReferenceCode}`,
          insurer,
          policyCategory: category,
          coverageSubtype,
          minimumEntryAge: Number(getCol('Minimum Entry Age', 'Min Age')) || null,
          maximumEntryAge: Number(getCol('Maximum Entry Age', 'Max Age')) || null,
          annualCoverageAmount,
          benefitSublimits,
          illustrativePremium,
          premiumBasis,
          risksConsidered,
          preExistingConditionRules,
          waitingPeriods,
          exclusions,
          excessDeductible,
          claimsProcess,
          sourceSheet: sheetName,
          sourceRowIndex: rowIndex,
          metadata
        });
      }
    }

    return extractedOffers;
  }

  /**
   * Persist extracted policy offers to MongoDB and index each with dedicated vectors in Qdrant
   */
  async persistAndIndexOffers(offersData, parentDocument, onProgress) {
    if (!offersData || offersData.length === 0) return [];

    console.log(`📦 Persisting & Vectorizing ${offersData.length} individual policy offers for '${parentDocument.title}'...`);

    // 1. Save or update policy offers in MongoDB
    const savedOffers = [];
    for (const data of offersData) {
      // Upsert by policyReferenceCode and parentDocumentId
      const offer = await PolicyOffer.findOneAndUpdate(
        {
          parentDocumentId: parentDocument._id,
          policyReferenceCode: data.policyReferenceCode
        },
        { ...data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      savedOffers.push(offer);
    }

    // 2. Vectorize and upsert into Qdrant
    const embedder = getEmbeddingModel();
    const textsToVectorize = savedOffers.map((o) => formatPolicyOfferText(o));
    const vectors = await embedder.embedDocuments(textsToVectorize);
    const pointsToUpsert = [];
    const total = savedOffers.length;

    for (let i = 0; i < total; i++) {
      const offer = savedOffers[i];
      const textToVectorize = textsToVectorize[i];
      const vector = vectors[i];

      // Generate deterministic UUID for this offer's vector point in Qdrant
      const pointId = generateDeterministicUUID(`${parentDocument._id}_${offer.policyReferenceCode}`);

      pointsToUpsert.push({
        id: pointId,
        vector,
        payload: {
          documentId: parentDocument._id.toString(),
          policyOfferId: offer._id.toString(),
          policyReferenceCode: offer.policyReferenceCode,
          policyType: offer.policyCategory,
          policyCategory: offer.policyCategory,
          title: offer.planName,
          planName: offer.planName,
          insurer: offer.insurer,
          annualCoverageAmount: offer.annualCoverageAmount,
          excessDeductible: offer.excessDeductible,
          illustrativePremium: offer.illustrativePremium,
          benefitSublimits: offer.benefitSublimits,
          waitingPeriods: offer.waitingPeriods,
          exclusions: offer.exclusions,
          claimsProcess: offer.claimsProcess,
          sourceSheet: offer.sourceSheet,
          isIndividualPolicyOffer: true,
          content: textToVectorize,
          text: textToVectorize
        }
      });

      // Update offer with its chunkText, 384-dim vector, and Qdrant point ID in MongoDB
      offer.chunkText = textToVectorize;
      offer.vector = vector;
      offer.qdrantPointId = pointId;
      await offer.save();

      if (onProgress && (i + 1) % 5 === 0) {
        onProgress({
          percent: 50 + Math.round(((i + 1) / total) * 45),
          stage: 'vectorizing_offers',
          message: `Indexed ${i + 1}/${total} individual policy offers into database...`
        });
      }
    }

    // 3. Batch upsert all vector points into Qdrant (non-blocking if Qdrant is offline)
    if (pointsToUpsert.length > 0) {
      try {
        await upsertPoints(pointsToUpsert);
        console.log(`✅ Successfully indexed ${pointsToUpsert.length} policy offers in Qdrant for document ${parentDocument._id}`);
      } catch (qErr) {
        console.warn(`⚠️ Qdrant offline notice (vectors stored in MongoDB): ${qErr.message}`);
      }
    }

    // Update parent document's batch catalogue metadata
    parentDocument.isBatchCatalogue = true;
    parentDocument.totalOffersCount = savedOffers.length;
    await parentDocument.save();

    return savedOffers;
  }

  /**
   * Update an individual policy offer and immediately re-sync its database & Qdrant vector point
   */
  async updateOffer(offerId, updateData) {
    const offer = await PolicyOffer.findById(offerId);
    if (!offer) {
      throw ApiError.notFound('Policy offer not found');
    }

    // Allowed updatable fields
    const fields = [
      'planName',
      'insurer',
      'policyCategory',
      'coverageSubtype',
      'annualCoverageAmount',
      'benefitSublimits',
      'illustrativePremium',
      'premiumBasis',
      'excessDeductible',
      'waitingPeriods',
      'exclusions',
      'risksConsidered',
      'preExistingConditionRules',
      'claimsProcess',
      'status'
    ];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        offer[field] = updateData[field];
      }
    });

    // Re-generate vector embedding and save in MongoDB + Qdrant
    try {
      const embedder = getEmbeddingModel();
      const updatedText = formatPolicyOfferText(offer);
      const vector = await embedder.embedQuery(updatedText);
      const pointId = offer.qdrantPointId || generateDeterministicUUID(`${offer.parentDocumentId}_${offer.policyReferenceCode}`);

      offer.chunkText = updatedText;
      offer.vector = vector;
      offer.qdrantPointId = pointId;
      await offer.save();

      await upsertPoints([
        {
          id: pointId,
          vector,
          payload: {
            documentId: offer.parentDocumentId.toString(),
            policyOfferId: offer._id.toString(),
            policyReferenceCode: offer.policyReferenceCode,
            policyType: offer.policyCategory,
            policyCategory: offer.policyCategory,
            title: offer.planName,
            planName: offer.planName,
            insurer: offer.insurer,
            annualCoverageAmount: offer.annualCoverageAmount,
            excessDeductible: offer.excessDeductible,
            illustrativePremium: offer.illustrativePremium,
            benefitSublimits: offer.benefitSublimits,
            waitingPeriods: offer.waitingPeriods,
            exclusions: offer.exclusions,
            claimsProcess: offer.claimsProcess,
            sourceSheet: offer.sourceSheet,
            isIndividualPolicyOffer: true,
            content: updatedText,
            text: updatedText
          }
        }
      ]);

      console.log(`🔄 Re-synced vector for Policy Offer '${offer.policyReferenceCode}' (${offer.planName})`);
    } catch (err) {
      await offer.save();
      console.warn(`⚠️ Qdrant sync notice for offer ${offer._id} (saved in MongoDB):`, err.message);
    }

    return offer;
  }

  /**
   * List policy offers with multi-criteria filtering, searching, and sorting
   */
  async listOffers(queryParams = {}) {
    const { parentDocumentId, policyCategory, insurer, search, status, page = 1, limit = 50 } = queryParams;
    const query = {};

    if (parentDocumentId) query.parentDocumentId = parentDocumentId;
    if (policyCategory && policyCategory !== 'ALL') query.policyCategory = policyCategory;
    if (insurer) query.insurer = { $regex: insurer, $options: 'i' };
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { planName: { $regex: search, $options: 'i' } },
        { policyReferenceCode: { $regex: search, $options: 'i' } },
        { insurer: { $regex: search, $options: 'i' } },
        { coverageSubtype: { $regex: search, $options: 'i' } },
        { exclusions: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [offers, totalCount] = await Promise.all([
      PolicyOffer.find(query).select('-vector').sort({ policyReferenceCode: 1 }).skip(skip).limit(Number(limit)),
      PolicyOffer.countDocuments(query)
    ]);

    return {
      offers,
      totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit))
    };
  }

  /**
   * Get a single policy offer by ID
   */
  async getOfferById(id) {
    const offer = await PolicyOffer.findById(id).populate('parentDocumentId', 'title originalFileName policyCode');
    if (!offer) {
      throw ApiError.notFound('Policy offer not found');
    }
    return offer;
  }

  /**
   * Delete an individual policy offer from MongoDB and remove its vector from Qdrant
   */
  async deleteOffer(id) {
    const offer = await PolicyOffer.findById(id);
    if (!offer) {
      throw ApiError.notFound('Policy offer not found');
    }

    // 1. Gather all possible Qdrant vector point IDs
    const pointIds = [];
    if (offer.qdrantPointId) pointIds.push(offer.qdrantPointId);
    if (offer.parentDocumentId && offer.policyReferenceCode) {
      pointIds.push(generateDeterministicUUID(`${offer.parentDocumentId}_${offer.policyReferenceCode}`));
    }

    // 2. Delete points by ID from Qdrant vector collection
    if (pointIds.length > 0) {
      try {
        await deletePointsByIds(pointIds);
      } catch (err) {
        console.warn(`Warning: Failed to delete Qdrant vector points for offer ${id}:`, err.message);
      }
    }

    // 3. Purge Qdrant vectors matching offerId or policyReferenceCode payload filter
    try {
      await deleteVectorsByOfferId(offer._id, offer.policyReferenceCode);
    } catch (err) {
      console.warn(`Warning: Failed to delete Qdrant vectors by filter for offer ${id}:`, err.message);
    }

    // 4. Delete offer from MongoDB
    await PolicyOffer.findByIdAndDelete(id);

    // 5. Decrement parent document offer count if applicable
    if (offer.parentDocumentId) {
      await PolicyDocument.findByIdAndUpdate(offer.parentDocumentId, {
        $inc: { totalOffersCount: -1 }
      });
    }

    console.log(`✅ Successfully removed policy offer '${offer.planName}' (${offer.policyReferenceCode}): Qdrant purged and MongoDB record deleted.`);

    return {
      _id: id,
      policyReferenceCode: offer.policyReferenceCode,
      planName: offer.planName
    };
  }
}

export const policyOfferService = new PolicyOfferService();
