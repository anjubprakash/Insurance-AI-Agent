import mongoose from "mongoose";
import { getGroqClient } from "./aiProvider.service.js";
import { searchSimilarPolicyClauses } from "./vectorStore.service.js";
import { PolicyOffer } from "../models/policyOffer.model.js";
import { PolicyDetail } from "../models/policyDetail.model.js";
import { User } from "../models/user.model.js";
import { policyDetailService } from "./policyDetail.service.js";
import { authService } from "./auth.service.js";
import { env } from "../config/env.js";

export const formatAmount = (val) => {
  if (!val) return "Not specified";
  const str = String(val).trim();
  return /^\d+(\.\d+)?$/.test(str)
    ? `£${Number(str).toLocaleString("en-GB")}`
    : str;
};

// Robust Groq completion with exponential backoff on 429
const callGroqWithRetry = async (groq, params, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await groq.chat.completions.create(params);
    } catch (err) {
      if (
        attempt < maxAttempts &&
        (err.status === 429 || String(err.message).includes("429"))
      ) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
};

const SYSTEM_PROMPT = `You are an expert, empathetic, and authoritative AI Insurance Advisor powered by advanced Natural Language Processing (NLP).
You understand user intent, insurance domains, conversational context, and underwriting requirements naturally without rigid keyword scripts.

CUSTOMER IDENTITY & PERSONALIZATION RULES (STRICT):
1. The customer's registered account name is provided in the prompt as "Customer Name".
   - You must ONLY use this exact name (e.g. if the name is "user4", greet as "user4" or use a warm polite greeting).
   - NEVER invent, assume, or substitute names (e.g. NEVER call them "Alex", "John", etc.).
2. Ground Truth & Policy Numbers:
   - Consult RECORDED ENROLLED POLICIES GROUND TRUTH to see what policies the customer currently has on file.
   - If Ground Truth states the customer has NO active enrolled policies, you MUST NOT invent, assume, cite, or hallucinate any policy numbers (#POL-...). NEVER mention fast-tracking non-existent or pending policies!
3. Budget & Premium Integrity:
   - NEVER invent or hallucinate an arbitrary budget for the customer (e.g. do NOT invent "within your £24-£30 per month budget" unless the customer explicitly stated that budget).
   - If the customer specifies a budget (e.g. "£20-£25/month"), only discuss plans that match or fit closely with that budget. Never suggest plans that cost double or quadruple their stated budget.
4. CATALOG LIMITATION & NO-MATCH HONESTY (CRITICAL):
   - You can ONLY recommend policies that actually exist in the RELEVANT POLICIES IN KNOWLEDGE BASE.
   - If a customer asks for an asset type, vehicle type, or coverage that does NOT exist in our catalog (e.g. asking for two-wheeler / motorbike / motorcycle / scooter insurance when the catalog only contains car, van, or fleet policies):
     * State directly, simply, and truthfully: "We currently do not offer two-wheeler (motorbike/motorcycle) insurance in our catalog. Our motor insurance plans currently cover four-wheeled passenger cars and commercial fleets."
     * Do NOT invent fake next steps: NEVER say "I will forward your profile to our underwriting team in 24-48 hours" or "upload your documents in Profile for a custom quote". There is no offline underwriting queue.
     * Do NOT recommend irrelevant policies:
       - Set "isReadyForRecommendations": false.
       - Set "recommendedPlanCodes": [].
       - NEVER recommend car policies, electric car policies, or commercial fleet policies for a motorcycle/bike inquiry!
       - If no relevant policies exist for what the user is asking, state that clearly and show NO cards.

INSURANCE DOMAINS KNOWLEDGE SPECIFICATION (10 CATEGORIES):

1. AUTO (Motor Insurance):
   - Conversational Parameters (Ask naturally in chat for quotes):
     * Driver's age
     * Vehicle make, model, variant, and manufacturing year
     * Coverage type needed (Comprehensive vs Third-Party)
     * Primary usage (personal daily commute vs commercial) and driving history / claims / NCB %
   - Sensitive KYC / Official Documents (NEVER ask to paste in chat; direct user to Profile):
     * Vehicle Registration Certificate (RC copy), Engine & Chassis numbers, inspection photos/videos.
     * Guidance: Tell the customer to securely upload and complete official vehicle documents under their Profile.

2. HEALTH:
   - Conversational Parameters (Ask naturally in chat for quotes):
     * Exact age and gender of all members to be covered
     * Pre-existing medical conditions (diabetes, hypertension, asthma, past surgeries, or explicit confirmation of "None")
     * Basic lifestyle habits (smoking, tobacco consumption)
     * Existing health cover or preferred hospital room/cover amount
   - Sensitive KYC / Official Documents (NEVER ask to paste in chat; direct user to Profile):
     * Identity and address proofs (Aadhaar, PAN, Passport), past medical discharge summaries, diagnostic checkup reports.
     * Guidance: Instruct customer to safely upload identity proofs and clinical reports in their Profile.

3. HOME:
   - Conversational Parameters:
     * Property type (independent house, flat/apartment, villa) and age of building
     * Number of bedrooms / approximate square footage and general location
     * Coverage needed (building structure only, contents only, or combined)
     * Basic security measures (burglar alarm, fire extinguisher, gated community)
   - Sensitive KYC / Official Documents:
     * Sale deed, property tax receipts, floor plan/valuation certificates, property photos (direct to Profile).

4. LIFE:
   - Conversational Parameters:
     * Insured person's age
     * Smoking/tobacco status and general health status
     * Broad annual income range and occupation type
     * Nominee relation and desired coverage term / sum assured
   - Sensitive KYC / Official Documents:
     * Aadhaar, Passport, Salary slips, Form 16, ITR copies, diagnostic blood/ECG reports (direct to Profile).

5. COMMERCIAL:
   - Conversational Parameters:
     * Nature of business operations / industry trade
     * Estimated annual turnover range and employee headcount
     * Core coverage needed (public liability, stock/machinery, professional indemnity, fleet)
   - Sensitive KYC / Official Documents:
     * GSTIN, PAN, incorporation certificate, trade license, audited balance sheets, safety audit clearances (direct to Profile).

6. ACCIDENT (Personal Accident):
   - Conversational Parameters:
     * Insured age and occupation risk classification (desk job vs heavy machinery/field)
     * Pre-existing physical disabilities or impairments
     * Desired accidental death and permanent disability cover
   - Sensitive KYC / Official Documents:
     * Government ID proofs, Nominee official ID proofs (direct to Profile).

7. AGRICULTURE (Crop / Farm):
   - Conversational Parameters:
     * Type of crop cultivated and approximate farm area (acreage)
     * Sowing timeline and irrigation source (rainfed vs canal/borewell)
   - Sensitive KYC / Official Documents:
     * Land title deed (Khata, 7/12 extract), sowing certificate from patwari/panchayat, bank account details for direct subsidies (direct to Profile).

8. TRAVEL:
   - Conversational Parameters:
     * Destination country/countries
     * Travel dates / trip duration
     * Traveler age and any pre-existing medical conditions
     * Purpose (leisure, business, or adventure sports)
   - Sensitive KYC / Official Documents:
     * Passport copies, visa copies, flight tickets/boarding passes (direct to Profile).

9. LIABILITY (Directors & Officers / E&O / General Liability):
   - Conversational Parameters:
     * Scope of professional services or product lines manufactured
     * Geographic spread of operations (domestic vs international exports)
     * Prior claims or known dispute circumstances
   - Sensitive KYC / Official Documents:
     * Standard client contracts, corporate incorporation records, audited financial statements (direct to Profile).

10. GENERAL:
   - Conversational Parameters:
     * Precise description of asset or event being insured
     * Duration of coverage needed and desired deductible/excess
   - Sensitive KYC / Official Documents:
     * Purchase invoices, valuation certificates, customs documentation (direct to Profile).

CORE CONVERSATIONAL RECOMMENDATION READINESS RULES:
1. RECOMMENDATION UNLOCKING & EXPLORATION GUIDANCE (CRITICAL):
   - Recommendations are UNLOCKED ("isReadyForRecommendations": true) ONLY IF:
     1. The user has shared their basic conversational parameters for that category (e.g. for AUTO: driver age AND vehicle details; for HEALTH: age AND basic health status; for ACCIDENT: age AND occupation/risk level; for LIFE: age AND broad occupation).
     AND
     2. RELEVANT POLICIES IN KNOWLEDGE BASE actually contains matching policies for that specific asset/vehicle type!
   - CATALOG LIMITATION / UNSUPPORTED SUBTYPES (e.g. Two-Wheelers / Motorbikes):
     * If the customer asks for an asset or vehicle type not covered in the catalog (e.g. they ask for two-wheeler / motorbike / motorcycle / scooter, but the catalog only contains car policies):
       - "isReadyForRecommendations" MUST BE FALSE!
       - "recommendedPlanCodes" MUST BE EMPTY []!
       - In "answer", directly, simply, and honestly inform the user: "We currently do not offer two-wheeler (motorbike/motorcycle) insurance in our catalog. Our auto insurance plans currently cover four-wheeled passenger cars and commercial fleets."
       - That is ALL. NEVER invent fake processes (e.g. NEVER say "I will forward your profile to our underwriting team in 24-48 hours", and NEVER tell them to upload documents in Profile for a quote we do not offer).
   - UNDECIDED OR EXPLORING CUSTOMERS (When matching policies exist):
     * If a customer shares their basic profile (e.g., 25-year-old truck driver, healthy / no body problems) and asks "what coverage options do you have?", "what plans are available?", "show me options", or asks for advice on what to choose:
     * "isReadyForRecommendations" MUST BE TRUE!
     * "recommendedPlanCodes" MUST BE POPULATED with matching policy reference codes from RELEVANT POLICIES IN KNOWLEDGE BASE.
     * In "answer", present and compare the available coverage tiers from the catalog so the customer can immediately review their options.
     * DO NOT block recommendations or interrogate the customer to guess an exact sum-insured figure when they are asking what options you offer.
     * DO NOT re-ask questions the customer already answered (e.g. "no problem with my body" means pre-existing conditions are NONE).
     * NEVER invent or assume an arbitrary budget (e.g., do NOT invent "within your £24-£30 budget" unless the customer explicitly specified that budget).
2. ONLY BLOCK RECOMMENDATIONS WHEN CUSTOMER PROVIDED ZERO CONTEXT:
   - "isReadyForRecommendations" MUST BE FALSE ONLY IF the customer asks for recommendations (e.g. "give me recommendations", "show me plans") without providing ANY background context (no age, no category details, no occupation/vehicle).
   - In that zero-context case:
     * "isReadyForRecommendations": false.
     * "recommendedPlanCodes": [].
     * Politely explain that you will gladly display matching recommendations, and ask the 2-3 essential conversational parameters to tailor the quote.
3. SENSITIVE KYC & DOCUMENT PRIVACY (CRITICAL):
   - If the customer mentions or asks about sharing sensitive identity proofs, official documents, or financial records (such as Aadhaar, PAN, RC copies, engine/chassis numbers, bank details, tax returns):
     * Set "sensitiveDocsNoticeNeeded": true.
     * Warmly advise them: "For your privacy and security, please do not share confidential documents like Aadhaar, PAN, or RC details in this chat. You can safely complete and upload those in your Profile & Documents page."
4. GROUND TRUTH (EXISTING DATABASE POLICIES):
   - Consult RECORDED ENROLLED POLICIES GROUND TRUTH to understand what policies the customer already has on file.
   - Never re-ask for details already saved in Ground Truth.
5. DEDICATED TARGET POLICY FOCUS:
   - If a TARGET POLICY FOCUS is present, the user is having a 1-on-1 discussion about that specific plan. Address coverage, limits, premiums, and claims specifically for that plan.

STRICT JSON OUTPUT FORMAT:
{
  "detectedInsuranceType": "AUTO" | "HEALTH" | "HOME" | "LIFE" | "COMMERCIAL" | "ACCIDENT" | "AGRICULTURE" | "TRAVEL" | "LIABILITY" | "GENERAL",
  "extractedProfile": {
    "whoIsInsured": "SELF" | "SPOUSE" | "PARENTS" | "BUSINESS" | "CHILD" | "FAMILY",
    "insuredName": "Full name or business name",
    "coveredAge": null,
    "healthOrRiskConditions": "Category-specific details (e.g. 2022 Honda Civic, diabetes status, 3-bed flat)",
    "sumInsured": "Coverage limit or tier",
    "selectedPlanName": null
  },
  "missingRequiredFields": ["list of missing conversational parameters"],
  "isReadyForRecommendations": false,
  "sensitiveDocsNoticeNeeded": false,
  "answer": "Warm, natural, and clear response generated entirely by you (use bullet points, zero rigid scripts, zero bulky tables).",
  "recommendedPlanCodes": []
}`;

// Grounded Intelligent Recommendations Engine (Strict Category Isolation & Relevance Ranking)
// Displays ONLY policies from the requested category. Zero cross-category backfill.
// Ranks the most related policies to the user's specific profile at the top.
export const getIntelligentRecommendations = async ({
  category,
  intakeData = {},
  allActiveOffers = [],
  recommendedPlanCodes = [],
  targetOffer = null,
  limit = 6,
}) => {
  if (targetOffer) return [];

  const catUpper = (category || "GENERAL").toUpperCase();

  // STRICT CATEGORY FILTER: Only policies matching this exact insurance category
  const categoryOffers = allActiveOffers.filter(
    (o) => o.policyCategory?.toUpperCase() === catUpper,
  );

  if (categoryOffers.length === 0) {
    return [];
  }

  const userAge = intakeData.coveredAge ? Number(intakeData.coveredAge) : null;
  const conditionText = (intakeData.healthOrRiskConditions || "").toLowerCase();
  const tokens = conditionText
    .split(/[\s,./-]+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !["and", "for", "the", "with", "have", "has", "none", "plan", "need"].includes(w),
    );

  const scoreOffer = (offer) => {
    let score = 100;

    // 1. Eligibility Check: Entry Age
    if (userAge != null) {
      const minAge =
        offer.minimumEntryAge != null ? Number(offer.minimumEntryAge) : null;
      const maxAge =
        offer.maximumEntryAge != null ? Number(offer.maximumEntryAge) : null;

      // Disqualify if outside entry age criteria
      if (minAge != null && userAge < minAge) return -999;
      if (maxAge != null && userAge > maxAge) return -999;

      if (minAge != null && maxAge != null && userAge >= minAge && userAge <= maxAge) {
        score += 25;
      }
    }

    // 2. LLM Explicit Selection Bonus
    if (
      recommendedPlanCodes.some(
        (code) =>
          String(code).trim().toLowerCase() ===
          offer.policyReferenceCode?.toLowerCase(),
      )
    ) {
      score += 50;
    }

    // 3. Search text & keyword relevance matching
    const haystack = [
      offer.planName,
      offer.coverageSubtype,
      offer.risksConsidered,
      offer.benefitSublimits,
      offer.preExistingConditionRules,
      offer.exclusions,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += 15;
      }
    }

    // 4. Domain & User Profile Specific Relevance (Top Picks based on user details)
    if (catUpper === "ACCIDENT") {
      // High-risk occupation / driving / machinery / field work
      const isWorkOrDriving = /truck|driver|driving|heavy|machinery|occupational|work|worker|hazard/i.test(conditionText);
      if (isWorkOrDriving && /occupational|work|workplace|job/i.test(haystack)) {
        score += 65; // Places WorkWell Occupational at the #1 Top Pick!
      }
      // Family protection
      const isFamily = /family|child|children|wife|spouse|dependents/i.test(conditionText);
      if (isFamily && /family|guardian/i.test(haystack)) {
        score += 40;
      }
    } else if (catUpper === "AUTO") {
      const isTwoWheeler = /\b(bike|motorbike|motorcycle|scooter|moped|two-wheeler|2-wheeler|bullet|royal enfield|classic 350|honda cb|ducati|harley|yamaha|kawasaki|vespa|tvs|bajaj)\b/i.test(conditionText);
      const isBikePlan = /\b(bike|motorbike|motorcycle|scooter|two-wheeler|2-wheeler)\b/i.test(haystack);

      // If user is asking for a motorcycle/bike, but policy is for passenger cars -> DISQUALIFY!
      if (isTwoWheeler && !isBikePlan) {
        return -999;
      }

      // Disqualify commercial fleet policies for personal vehicle commute inquiries
      const isFleetOrCommercialOnly = /\b(fleet|commercial fleet|small business motor)\b/i.test(haystack);
      const isPersonalCommute = !/commercial|fleet|business|courier|delivery|transit/i.test(conditionText) && intakeData.whoIsInsured !== 'BUSINESS';
      if (isFleetOrCommercialOnly && isPersonalCommute) {
        return -999;
      }

      // Disqualify specialized EV policies if user has a petrol/diesel vehicle
      const isEVPlan = /\b(electric vehicle|ev protect|battery & charger)\b/i.test(haystack);
      const isUserEV = /electric|ev\b|battery|hybrid|tesla/i.test(conditionText);
      if (isEVPlan && !isUserEV) {
        return -999;
      }

      // Budget sensitivity: disqualify policies that exceed 2.5x the user's explicit budget
      const budgetMatch = conditionText.match(/(?:budget|paymnet|payment|around|approx|monthly|month)\D*(\d+)(?:\s*(?:to|-)\s*(\d+))?/i);
      if (budgetMatch) {
        const maxBudget = Number(budgetMatch[2] || budgetMatch[1]);
        if (maxBudget > 0) {
          const offerPremiumMatch = (offer.illustrativePremium || "").match(/£?(\d+)/);
          if (offerPremiumMatch) {
            const offerPremium = Number(offerPremiumMatch[1]);
            if (offerPremium > maxBudget * 2.5) {
              return -999;
            }
          }
        }
      }

      if (isUserEV && /electric|ev\b|battery/i.test(haystack)) score += 60;
      const isCommercialUsage = /commercial|business|transit|goods|taxi|delivery|van/i.test(conditionText);
      if (isCommercialUsage && /commercial|transit|van|fleet/i.test(haystack)) score += 50;
      const isComprehensive = /comprehensive|full/i.test(conditionText);
      if (isComprehensive && /comprehensive/i.test(haystack)) score += 30;
    } else if (catUpper === "HEALTH") {
      const isSenior = userAge && userAge >= 60;
      if (isSenior && /senior|elderly|plus/i.test(haystack)) score += 50;
      const hasCondition =
        conditionText.length > 3 && !/none|no\b|clean/i.test(conditionText);
      if (hasCondition && /pre-existing/i.test(haystack)) score += 40;
      const isFamily = /family|spouse|children/i.test(conditionText);
      if (isFamily && /family|comprehensive/i.test(haystack)) score += 30;
    } else if (catUpper === "COMMERCIAL") {
      if (/fleet/i.test(conditionText) && /fleet/i.test(haystack)) score += 40;
      if (/liability/i.test(conditionText) && /liability/i.test(haystack)) score += 30;
    } else if (catUpper === "LIFE") {
      const isTerm = /term|lump\s*sum|family/i.test(conditionText);
      if (isTerm && /term|lane|family/i.test(haystack)) score += 40;
    }

    return score;
  };

  // Rank eligible offers in this category descending by relevance score (most related first)
  const rankedOffers = categoryOffers
    .map((offer) => ({ offer, score: scoreOffer(offer) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.offer);

  // Return strictly the matching offers in this category up to limit (zero cross-category backfill)
  return rankedOffers.slice(0, limit);
};

// Saves or updates policy details progressively using policyDetailService CRUD
const savePolicyIntakeViaService = async ({
  user,
  category,
  profile = {},
  selectedOffer = null,
  isEnrolled = false,
}) => {
  if (!user?._id || mongoose.connection.readyState !== 1) {
    return { savedPolicy: null, updatedUser: null, dbUpdated: false };
  }

  const insuranceType = (
    category ||
    profile.insuranceType ||
    selectedOffer?.policyCategory ||
    "GENERAL"
  ).toUpperCase();

  const rawWho = (profile.whoIsInsured || "").trim().toUpperCase();
  const whoIsInsured =
    rawWho || (insuranceType === "COMMERCIAL" ? "BUSINESS" : "SELF");
  const insuredName = (profile.insuredName || "").trim();

  try {
    const userDoc = await User.findById(user._id);
    if (!userDoc)
      return { savedPolicy: null, updatedUser: null, dbUpdated: false };

    // Update user demographic age if self-insured
    if (whoIsInsured === "SELF" && profile.coveredAge) {
      userDoc.age = Number(profile.coveredAge);
      await userDoc.save();
    }

    // STRICT SAFETY BARRIER: Chat exploration must NEVER create a PolicyDetail record or mint a policy number!
    // A policy is ONLY created or updated when the user has explicitly selected/enrolled in an offer.
    if (!isEnrolled || !selectedOffer) {
      return { savedPolicy: null, updatedUser: userDoc, dbUpdated: false };
    }

    const planName = selectedOffer.planName || `${insuranceType} Insurance Plan`;
    const sumInsured = formatAmount(selectedOffer.annualCoverageAmount) || profile.sumInsured || "";
    const premium = selectedOffer.illustrativePremium || "";
    const status = "ACTIVE";

    // Retrieve user's existing policies via policyDetailService
    const existingPolicies = await policyDetailService.getUserPolicies(user._id);

    // Look for existing active policy for this insurance type or plan
    let existingDoc = existingPolicies.find(
      (p) =>
        p.status === "ACTIVE" &&
        ((p.policyNumber && p.policyNumber.includes(selectedOffer.policyReferenceCode)) ||
          p.policyName?.toLowerCase() === planName.toLowerCase() ||
          p.insuranceType === insuranceType),
    );

    let policyDoc = null;

    if (existingDoc) {
      // UPDATE via policyDetailService
      const updateData = {
        policyName: planName,
        insuranceType,
        whoIsInsured,
        status,
      };
      if (insuredName) updateData.insuredName = insuredName;
      if (profile.coveredAge) updateData.coveredAge = Number(profile.coveredAge);
      if (profile.healthOrRiskConditions)
        updateData.healthOrRiskConditions = profile.healthOrRiskConditions;
      if (sumInsured) updateData.sumInsured = sumInsured;
      if (premium) updateData.premium = premium;

      policyDoc = await policyDetailService.updatePolicy(
        existingDoc._id,
        user._id,
        updateData,
        user.role || "POLICYHOLDER",
      );
    } else {
      // CREATE newly enrolled active policy via policyDetailService
      policyDoc = await policyDetailService.createPolicy(user._id, {
        policyName: planName,
        insuranceType,
        whoIsInsured,
        insuredName: insuredName || userDoc.name,
        coveredAge: profile.coveredAge ? Number(profile.coveredAge) : userDoc.age || null,
        healthOrRiskConditions: profile.healthOrRiskConditions || "",
        sumInsured,
        premium,
        status,
      });
    }

    if (policyDoc) {
      const updatedUser = await authService.getUserById(user._id);
      return { savedPolicy: policyDoc, updatedUser, dbUpdated: true };
    }

    return { savedPolicy: null, updatedUser: userDoc, dbUpdated: false };
  } catch (err) {
    console.warn("⚠️ Progressive policy save notice:", err.message);
    return { savedPolicy: null, updatedUser: null, dbUpdated: false };
  }
};

// Main Unified Insurance RAG Advisor Orchestrator
export const answerInsuranceQuery = async ({
  question,
  conversationHistory = [],
  policyTypeFilter = null,
  policyCodeFilter = null,
  planNameFilter = null,
  user = null,
}) => {
  const trimmed = (question || "").trim().toLowerCase();

  // 1. Fetch user's recorded policies using policyDetailService CRUD
  const allUserPolicies =
    user?._id && mongoose.connection.readyState === 1
      ? await policyDetailService.getUserPolicies(user._id)
      : [];

  // 2. Resolve single target offer if scoped
  let targetOffer = null;
  if (policyCodeFilter) {
    targetOffer = await PolicyOffer.findOne({
      policyReferenceCode: {
        $regex: `^${policyCodeFilter.trim()}$`,
        $options: "i",
      },
    });
  } else if (planNameFilter) {
    targetOffer = await PolicyOffer.findOne({
      planName: { $regex: planNameFilter.trim(), $options: "i" },
    });
  }

  // 3. Fast-path for common greetings
  if (
    /^(hi+|hello+|hey+|good\s+(morning|afternoon|evening)|help)[\s!.,?]*$/i.test(
      trimmed,
    )
  ) {
    const firstName = user?.name ? user.name.split(" ")[0] : "";
    return {
      queryId: `greeting_${Date.now()}`,
      question,
      answer: targetOffer
        ? `👋 Hello${firstName ? ` ${firstName}` : ""}! I am your dedicated advisor for **${targetOffer.planName}** (${targetOffer.insurer}). Ask me anything about its coverage limits, monthly premiums, excess deductibles, or how to get covered!`
        : `Hello${firstName ? ` ${firstName}` : ""}! 👋 I'm your AI Insurance Advisor. What type of insurance can I help you explore today (Auto, Health, Home, Life, Commercial, Travel, etc.)?`,
      confidence: "HIGH",
      userPolicies: allUserPolicies,
      recommendedOffers: [],
      createdAt: new Date().toISOString(),
    };
  }

  // 4. Semantic Search across Qdrant & MongoDB knowledge base
  let retrievedClauses = [];
  try {
    const filter = policyTypeFilter ? { policyType: policyTypeFilter } : null;
    retrievedClauses = await searchSimilarPolicyClauses(question, 4, filter);
  } catch (err) {
    console.warn("⚠️ Semantic search notice:", err.message);
  }

  let contextText =
    retrievedClauses.length > 0
      ? retrievedClauses
          .map(
            (c, i) =>
              `[SOURCE ${i + 1}] (${c.payload?.policyCode || "POLICY"}) ${c.payload?.title || c.payload?.planName || ""}\n${(c.payload?.content || "").slice(0, 450)}`,
          )
          .join("\n---\n")
      : "Rely on general insurance domain expertise.";

  if (targetOffer) {
    const targetBrief = `[PRIMARY TARGET PLAN] ${targetOffer.planName} (#${targetOffer.policyReferenceCode}) by ${targetOffer.insurer}
Category: ${targetOffer.policyCategory} | Type: ${targetOffer.coverageSubtype || "Standard"}
Coverage Limit: ${formatAmount(targetOffer.annualCoverageAmount)} | Monthly Premium: ${targetOffer.illustrativePremium || "N/A"}
Deductible / Excess: ${targetOffer.excessDeductible || "Standard"} | Benefits: ${targetOffer.benefitSublimits || "Comprehensive"}
Waiting Periods: ${targetOffer.waitingPeriods || "None"} | Exclusions: ${targetOffer.exclusions || "Standard policy exclusions"}`;
    contextText = `${targetBrief}\n---\n${contextText}`;
  }

  // 5. Build Ground Truth from Database Policies (Strictly Active Enrolled Policies Only)
  const activeUserPolicies = allUserPolicies.filter((p) => p.status === "ACTIVE");
  const groundTruthText =
    activeUserPolicies.length > 0
      ? `RECORDED ENROLLED POLICIES GROUND TRUTH (FROM DATABASE - DO NOT RE-ASK):\n` +
        activeUserPolicies
          .map(
            (p, i) =>
              `#${i + 1}: Policy Number ${p.policyNumber || "N/A"}, Plan: "${p.policyName}", Category: ${p.insuranceType}, Insured: "${p.insuredName || p.whoIsInsured}", Age: ${p.coveredAge || "N/A"}, Conditions: "${p.healthOrRiskConditions || "None"}", Limit: ${p.sumInsured || "N/A"}, Status: ${p.status}`,
          )
          .join("\n")
      : "RECORDED ENROLLED POLICIES GROUND TRUTH: The customer currently has NO active enrolled policies. You MUST NOT invent, assume, cite, or hallucinate any policy numbers (#POL-...)! NEVER mention fast-tracking non-existent policies.";

  const targetOfferPrompt = targetOffer
    ? `\n🎯 TARGET POLICY FOCUS (MANDATORY):
The user is having a dedicated discussion specifically about "${targetOffer.planName}" (#${targetOffer.policyReferenceCode}) offered by ${targetOffer.insurer}.
Coverage Limit: ${formatAmount(targetOffer.annualCoverageAmount)} | Premium: ${targetOffer.illustrativePremium} | Deductible: ${targetOffer.excessDeductible} | Benefits: ${targetOffer.benefitSublimits} | Waiting Periods: ${targetOffer.waitingPeriods}.
CRITICAL RULE: Answer the user's questions specifically regarding THIS policy. Do NOT confuse or switch to other policies from RECORDED ENROLLED POLICIES GROUND TRUTH unless the user explicitly asks to compare them.\n`
    : "";

  // 6. Single Unified Groq LLM Inference with Natural Language Processing
  const groq = getGroqClient();
  const startTime = Date.now();
  let answer = "";
  let confidence = "HIGH";
  let detectedInsuranceType = "GENERAL";
  let extractedProfile = {};
  let isReadyForRecommendations = false;
  let sensitiveDocsNoticeNeeded = false;
  let recommendedPlanCodes = [];

  try {
    const recentHistory = (conversationHistory || []).slice(-16);
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...recentHistory.map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: String(h.content || "").slice(0, 400),
      })),
      {
        role: "user",
        content: `Question: ${question}\n\nCustomer Name: "${user?.name || "Customer"}" (Registered user account name - you MUST address them ONLY by this exact name if using a name; do NOT substitute with "Alex" or any other name!)\n\n${targetOfferPrompt}\n\n${groundTruthText}\n\nRELEVANT POLICIES IN KNOWLEDGE BASE:\n${contextText}`,
      },
    ];

    const completion = await callGroqWithRetry(groq, {
      model: env.GROQ_MODEL,
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    answer = parsed.answer || "How can I assist with your insurance needs?";
    confidence = parsed.confidence || "HIGH";
    detectedInsuranceType = (parsed.detectedInsuranceType || "GENERAL").toUpperCase();
    extractedProfile = parsed.extractedProfile || {};
    isReadyForRecommendations = Boolean(parsed.isReadyForRecommendations);
    sensitiveDocsNoticeNeeded = Boolean(parsed.sensitiveDocsNoticeNeeded);
    recommendedPlanCodes = Array.isArray(parsed.recommendedPlanCodes)
      ? parsed.recommendedPlanCodes
      : [];
  } catch (err) {
    console.warn("⚠️ Groq call notice:", err.message);
    answer =
      "I am your Insurance Advisor. Could you please specify which insurance category you are interested in?";
    confidence = "MEDIUM";
  }
  const durationMs = Date.now() - startTime;

  // 7. Resolve Recommended Plan Cards & Plan Selection from DB
  let recommendedOffers = [];
  let selectedOffer = null;
  let isEnrolled = false;

  const allActiveOffers = await PolicyOffer.find({ status: "ACTIVE" }).select(
    "-vector",
  );

  // Strict enrollment intent detection: only triggers when user explicitly commands to buy/enroll/select
  const enrollRegex = /\b(enroll|enrolling|select this|choose this|buy this|purchase this|opt in|sign up for)\b/i;
  const isEnrollIntent = enrollRegex.test(trimmed);

  if (targetOffer && isEnrollIntent) {
    selectedOffer = targetOffer;
    isEnrolled = true;
  } else if (isEnrollIntent && extractedProfile.selectedPlanName) {
    const candidateName = extractedProfile.selectedPlanName.toLowerCase().trim();
    selectedOffer =
      allActiveOffers.find(
        (o) =>
          o.planName.toLowerCase() === candidateName ||
          candidateName.includes(o.planName.toLowerCase()) ||
          candidateName.includes(o.policyReferenceCode.toLowerCase()),
      ) || null;
    if (selectedOffer) isEnrolled = true;
  }

  if (selectedOffer && isEnrolled) {
    recommendedOffers = [selectedOffer];
  } else if (!targetOffer && isReadyForRecommendations) {
    // INTAKE READY: Provide 6 intelligent, grounded recommendations
    recommendedOffers = await getIntelligentRecommendations({
      category: detectedInsuranceType,
      intakeData: extractedProfile,
      allActiveOffers,
      recommendedPlanCodes,
      targetOffer,
      limit: 6,
    });
  } else {
    // INTAKE NOT READY: Strict lock on cards
    recommendedOffers = [];
  }

  // 8. Progressive Ground Truth Persistence via policyDetailService (Enrollment ONLY)
  const { savedPolicy, updatedUser, dbUpdated } = await savePolicyIntakeViaService({
    user,
    category: detectedInsuranceType,
    profile: extractedProfile,
    selectedOffer,
    isEnrolled,
  });

  const finalUserPolicies =
    dbUpdated && user?._id
      ? await policyDetailService.getUserPolicies(user._id)
      : allUserPolicies;

  return {
    queryId: `rag_${Date.now()}`,
    question,
    answer,
    recommendedOffers,
    savedPolicy,
    userPolicies: finalUserPolicies,
    updatedUser,
    confidence,
    durationMs,
    createdAt: new Date().toISOString(),
  };
};
