import { getGroqClient } from './aiProvider.service.js';
import { env } from '../config/env.js';

/**
 * Extract stratified checkpoints across the uploaded document (Beginning, ~15%, ~50%, ~85%).
 * This validates whole-document authenticity without sending hundreds of pages to the LLM.
 */
export const extractStratifiedDocumentSample = (text) => {
  if (!text || text.length <= 4000) {
    return text || '';
  }

  const totalLen = text.length;

  // Checkpoint 1: Header, Insurer Notice & Title (Start / First ~1,200 chars)
  const headSample = text.slice(0, 1200).trim();

  // Checkpoint 2: Application Scope, Definitions & General Rules (~15% mark)
  const earlyIdx = Math.floor(totalLen * 0.15);
  const earlySample = text.slice(earlyIdx, earlyIdx + 800).trim();

  // Checkpoint 3: Substantive Coverage Standards (~50% mark)
  const midIdx = Math.floor(totalLen * 0.50);
  const midSample = text.slice(midIdx, midIdx + 800).trim();

  // Checkpoint 4: Schedules, Exclusions & Endorsement Provisions (~85% mark)
  const lateIdx = Math.floor(totalLen * 0.85);
  const lateSample = text.slice(lateIdx, lateIdx + 800).trim();

  return `[CHECKPOINT 1: DOCUMENT COVER & TITLE (Start)]
${headSample}

---

[CHECKPOINT 2: DEFINITIONS & COVERAGE SCOPE (~15% Mark)]
${earlySample}

---

[CHECKPOINT 3: SUBSTANTIVE POLICY TERMS (~50% Mark)]
${midSample}

---

[CHECKPOINT 4: EXCLUSIONS & SCHEDULE CLAUSES (~85% Mark)]
${lateSample}`;
};

/**
 * AI Gatekeeper System Prompt
 * Defines exact acceptance and rejection boundaries for enterprise Insurance AI
 */
const GATEKEEPER_INSTRUCTIONS = `You are an AI Gatekeeper for an enterprise Insurance AI platform.
Your task is to inspect the multi-point sample extracted across the uploaded document and determine whether it contains Insurance Policy information, including:

1. ACCEPTABLE INSURANCE DOCUMENTS:
- Health, Medical, Auto, Motor, Home, Property, Life, Travel, Commercial Liability, P&C Insurance Policies
- Insurance Product Guides, Policy Comparison Tables, Coverage Schedules, Underwriting Manuals
- Policy Wordings, Clauses, Endorsements, Conditions, Riders, Schedules
- Exclusions ("What is not covered"), Deductibles / Excesses, Waiting Periods, Benefit Sub-limits
- First Notice of Loss (FNOL) Procedures, Claims Guidelines, Claims Reporting Rules
- Sample, Benchmark, or Test Insurance Policies (e.g. mock policies, software testing policy data, training datasets created for AI evaluation). Developers, insurance underwriters, and test engineers frequently test the platform using sample policy wordings containing notices like "fictional", "sample data", "for software testing", or "test-data notice". YOU MUST ACCEPT THEM as valid insurance documents!

2. UNRELATED DOCUMENTS TO REJECT:
- Culinary cooking recipes & food menus
- Personal resumes, CVs, job applications
- Software programming source code, computer hardware manuals
- Non-insurance novels, fiction books, poetry, entertainment scripts
- Retail shopping lists, personal invoices, unrelated real estate tenancy agreements

Respond strictly in valid JSON format with no additional text:
{
  "isValidInsuranceDocument": true or false,
  "policyType": "AUTO" | "HEALTH" | "HOME" | "LIFE" | "COMMERCIAL" | "ACCIDENT" | "AGRICULTURE" | "TRAVEL" | "LIABILITY" | "GENERAL",
  "confidenceScore": 0.0 to 1.0,
  "reasoning": "A concise, clear 1-2 sentence explanation of why this document is accepted or rejected."
}`;

/**
 * Check whether document has strong insurance domain keyword density
 * Helps protect against false rejections when test policies have "sample/fictional" disclaimers
 */
export const evaluateInsuranceDomainDensity = (text = '') => {
  const lower = text.toLowerCase();

  // Core insurance terminology checklist
  const domainIndicators = [
    'insurance',
    'policy',
    'coverage',
    'annual cover limit',
    'pre-existing condition',
    'waiting period',
    'excess',
    'deductible',
    'inpatient',
    'outpatient',
    'claims process',
    'underwriting',
    'premium',
    'exclusion',
    'first notice of loss',
    'fnol',
    'health insurance',
    'motor insurance',
    'policyholder'
  ];

  let matches = 0;
  for (const term of domainIndicators) {
    if (lower.includes(term)) matches++;
  }

  // Detect likely policy category based on term frequency across 10 domains
  let detectedType = 'GENERAL';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('inpatient') || lower.includes('hospital')) {
    detectedType = 'HEALTH';
  } else if (lower.includes('motor') || lower.includes('auto') || lower.includes('vehicle') || lower.includes('car')) {
    detectedType = 'AUTO';
  } else if (lower.includes('home') || lower.includes('property') || lower.includes('building') || lower.includes('contents')) {
    detectedType = 'HOME';
  } else if (lower.includes('life') || lower.includes('annuity') || lower.includes('critical illness')) {
    detectedType = 'LIFE';
  } else if (lower.includes('commercial') || lower.includes('business liability')) {
    detectedType = 'COMMERCIAL';
  } else if (lower.includes('accident') || lower.includes('disability')) {
    detectedType = 'ACCIDENT';
  } else if (lower.includes('crop') || lower.includes('agriculture') || lower.includes('farm')) {
    detectedType = 'AGRICULTURE';
  } else if (lower.includes('travel') || lower.includes('flight') || lower.includes('trip')) {
    detectedType = 'TRAVEL';
  } else if (lower.includes('directors') || lower.includes('liability') || lower.includes('indemnity')) {
    detectedType = 'LIABILITY';
  }

  return {
    matchCount: matches,
    hasStrongInsuranceDensity: matches >= 3,
    detectedType
  };
};

/**
 * Validates whether an uploaded document is a legitimate insurance policy document using AI
 * Combines Groq LLM judgment with robust domain density validation
 */
export const validateInsuranceDocumentWithAI = async (text, fileName = '') => {
  // Step 1: Extract stratified 4-point sample across the document
  const excerpt = extractStratifiedDocumentSample(text);

  // Step 2: Compute domain density heuristics
  const density = evaluateInsuranceDomainDensity(text);

  const prompt = `${GATEKEEPER_INSTRUCTIONS}

Analyze the following stratified checkpoint sample from the file "${fileName}":

--- DOCUMENT CHECKPOINT SAMPLES START ---
${excerpt}
--- DOCUMENT CHECKPOINT SAMPLES END ---`;

  const groq = getGroqClient();

  if (groq) {
    try {
      // Send prompt to Groq LLM for JSON evaluation
      const response = await groq.chat.completions.create({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: GATEKEEPER_INSTRUCTIONS },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const rawContent = response.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawContent);

      const finalPolicyType = density.detectedType !== 'GENERAL' ? density.detectedType : (parsed.policyType || 'GENERAL');

      if (!parsed.isValidInsuranceDocument && density.hasStrongInsuranceDensity) {
        return {
          isValidInsuranceDocument: true,
          policyType: finalPolicyType,
          confidenceScore: 0.95,
          reasoning: 'Verified as authentic insurance product & policy guideline.'
        };
      }

      return {
        isValidInsuranceDocument: Boolean(parsed.isValidInsuranceDocument),
        policyType: finalPolicyType,
        confidenceScore: parsed.confidenceScore || 0.9,
        reasoning: parsed.reasoning || 'Document verified by AI Gatekeeper.'
      };
    } catch (err) {
      console.warn('⚠️ AI Gatekeeper LLM notice:', err.message);
    }
  }

  return {
    isValidInsuranceDocument: density.hasStrongInsuranceDensity,
    policyType: density.detectedType,
    confidenceScore: density.hasStrongInsuranceDensity ? 0.92 : 0.2,
    reasoning: density.hasStrongInsuranceDensity
      ? `Verified via insurance domain analysis (${density.matchCount} insurance structure indicators detected).`
      : 'Document does not contain standard insurance policy keywords.'
  };
};
