import mongoose from 'mongoose';
import { getGroqClient } from './aiProvider.service.js';
import { searchSimilarPolicyClauses } from './vectorStore.service.js';
import { PolicyOffer } from '../models/policyOffer.model.js';
import { PolicyDetail } from '../models/policyDetail.model.js';
import { User } from '../models/user.model.js';
import { authService } from './auth.service.js';
import { formatPolicyOfferText } from './policyOffer.service.js';
import { env } from '../config/env.js';

export const PRIORITY_SLOTS = [
  'insuranceType',
  'whoIsInsured',
  'insuredName',
  'coveredAge',
  'healthOrRiskConditions'
];

export const formatAmount = (val) => {
  if (!val) return 'Not specified';
  const str = String(val).trim();
  return /^\d+(\.\d+)?$/.test(str) ? `£${Number(str).toLocaleString('en-GB')}` : str;
};

// Beneficiary & relationship synonym mapping for normalized storage
const WHO_SYNONYM_MAP = {
  DAD: 'FATHER', PAPA: 'FATHER', DADDY: 'FATHER',
  MOM: 'MOTHER', MUM: 'MOTHER', MAMA: 'MOTHER', MUMMY: 'MOTHER',
  PARENT: 'PARENTS',
  BOY: 'SON',
  GIRL: 'DAUGHTER',
  KID: 'CHILD', CHILDREN: 'CHILD', KIDS: 'CHILD',
  WIFE: 'SPOUSE', HUSBAND: 'SPOUSE', PARTNER: 'SPOUSE',
  BRO: 'BROTHER',
  SIS: 'SISTER',
  SIBLINGS: 'SIBLING',
  GRANDPA: 'GRANDFATHER', GRANDDAD: 'GRANDFATHER',
  GRANDMA: 'GRANDMOTHER', GRANNY: 'GRANDMOTHER',
  GRANDPARENTS: 'GRANDPARENT',
  ME: 'SELF', MYSELF: 'SELF', OWN: 'SELF',
  COMPANY: 'BUSINESS', PARTNERSHIP: 'BUSINESS', VENTURE: 'BUSINESS', STARTUP: 'BUSINESS', FIRM: 'BUSINESS', ENTERPRISE: 'BUSINESS'
};

// Helper: robust Groq completion with exponential backoff on 429 rate limit
const createGroqCompletionWithRetry = async (groq, params, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await groq.chat.completions.create(params);
    } catch (apiErr) {
      const isRateLimited = apiErr.status === 429 || String(apiErr.message).includes('429');
      if (attempt < maxAttempts && isRateLimited) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      throw apiErr;
    }
  }
};

//This function sends the user's message and recent conversation history to the LLM to understand the user's meaning and return structured information 
export const classifyAndContextualizeWithAI = async ({
  question = '',
  conversationHistory = [],
  policyTypeFilter = null
}) => {
  const trimmed = (question || '').trim();
  if (!trimmed) {
    return {
      intent: 'GENERAL_INQUIRY',
      isPersonalIntakeOrAction: false,
      isConversationalFollowUp: false,
      detectedCategory: policyTypeFilter && policyTypeFilter !== 'ALL' ? policyTypeFilter : 'GENERAL',
      selectedPlanName: null,
      standaloneSearchQuery: ''
    };
  }

  try {
    const groq = getGroqClient();
    const recentHistory = (conversationHistory || []).slice(-8);

    const systemPrompt = `You are an AI Insurance Intent Classifier & Query Contextualizer.
Analyze the user's latest message with ongoing conversation history.
Determine:
1. "intent":
   - "GENERAL_INQUIRY": Asking questions, exploring options, how insurance works, comparing plans, coverage limits, costs, exclusions.
   - "INTAKE_ANSWER": Providing customer intake details (names, ages, family roles, health conditions, medical history, business description, vehicle/home details).
   - "PLAN_SELECTION": Explicitly selecting, choosing, or enrolling in a specific plan or option (e.g. "Select Meadow Senior Care", "Option 2", "I pick this plan").
2. "isPersonalIntakeOrAction": boolean.
   - Set to TRUE if user provides personal/business intake details to be recorded (names, ages, health conditions, entity details) OR selects a plan.
   - Set to FALSE if user asks advisory/informational questions (e.g. how insurance works, options, comparing plans, benefits, costs, exclusions).
3. "isConversationalFollowUp": boolean (true if turn relies on prior context/pronouns).
4. "detectedCategory": "COMMERCIAL" | "HEALTH" | "AUTO" | "HOME" | "LIFE" | "ACCIDENT" | "AGRICULTURE" | "TRAVEL" | "GENERAL".
5. "selectedPlanName": Plan name/option if user is selecting/choosing a plan, else null.
6. "standaloneSearchQuery": Fully resolved standalone query for vector retrieval resolving pronouns and short answers.

Respond strictly in JSON:
{
  "intent": "GENERAL_INQUIRY" | "INTAKE_ANSWER" | "PLAN_SELECTION",
  "isPersonalIntakeOrAction": false,
  "isConversationalFollowUp": false,
  "detectedCategory": "COMMERCIAL" | "HEALTH" | "AUTO" | "HOME" | "LIFE" | "ACCIDENT" | "AGRICULTURE" | "TRAVEL" | "GENERAL",
  "selectedPlanName": null,
  "standaloneSearchQuery": "string"
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map((h) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: typeof h.content === 'string' ? h.content.slice(0, 300) : ''
      })),
      { role: 'user', content: trimmed }
    ];

    const completion = await createGroqCompletionWithRetry(groq, {
      model: env.GROQ_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });
//category finding 
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
    const validCategories = ['COMMERCIAL', 'HEALTH', 'AUTO', 'HOME', 'LIFE', 'ACCIDENT', 'AGRICULTURE', 'TRAVEL', 'GENERAL'];
    // Checks whether the AI returned a valid category. If not, it uses the selected policyTypeFilter or defaults to GENERAL
    const detectedCategory = validCategories.includes((parsed.detectedCategory || '').toUpperCase())
      ? parsed.detectedCategory.toUpperCase()
      : (policyTypeFilter && policyTypeFilter !== 'ALL' ? policyTypeFilter : 'GENERAL');

    return {
      intent: parsed.intent || 'GENERAL_INQUIRY',
      isPersonalIntakeOrAction: Boolean(parsed.isPersonalIntakeOrAction),
      isConversationalFollowUp: Boolean(parsed.isConversationalFollowUp),
      detectedCategory,
      selectedPlanName: parsed.selectedPlanName || null,
      standaloneSearchQuery: parsed.standaloneSearchQuery?.trim() || trimmed
    };
  } catch (err) {
    console.warn('⚠️ AI Intent Classification fallback:', err.message);
    return {
      intent: 'GENERAL_INQUIRY',
      isPersonalIntakeOrAction: false,
      isConversationalFollowUp: false,
      detectedCategory: policyTypeFilter && policyTypeFilter !== 'ALL' ? policyTypeFilter : 'GENERAL',
      selectedPlanName: null,
      standaloneSearchQuery: trimmed
    };
  }
};

// Helper: converts wide Markdown tables into simple bullet points to make answers easier to read
const formatConciseWidgetAnswer = (markdownText = '', askedForTable = false) => {
  if (!markdownText || askedForTable) return markdownText;

  const text = markdownText
    .replace(/\n*_?All excerpts are taken verbatim[^\n]*_?\s*$/gi, '')
    .trim();

  const lines = text.split('\n');
  const out = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTableRow = line.startsWith('|') && line.endsWith('|') && line.split('|').length > 2;
    const isSeparatorRow = isTableRow && /^[\s|:\-]+$/.test(line);

    if (isTableRow) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim().replace(/<br\s*\/?>/gi, '; '));

      if (!inTable) {
        inTable = true;
      } else if (!isSeparatorRow) {
        const primary = cells[0] || '';
        const details = cells
          .slice(1)
          .filter(Boolean)
          .join(' — ');
        if (primary || details) {
          out.push(`- ${primary.startsWith('**') ? primary : `**${primary}**`}: ${details}`);
        }
      }
    } else {
      if (inTable) {
        inTable = false;
      }
      out.push(lines[i]);
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

export const getRequiredSlotsForCategory = (category = 'HEALTH') => {
  const cat = (category || 'HEALTH').toUpperCase();
  switch (cat) {
    case 'COMMERCIAL':
      return ['insuranceType', 'whoIsInsured', 'insuredName'];
    case 'HOME':
      return ['insuranceType', 'whoIsInsured', 'insuredName'];
    case 'AUTO':
      return ['insuranceType', 'whoIsInsured', 'insuredName', 'coveredAge'];
    case 'TRAVEL':
      return ['insuranceType', 'whoIsInsured', 'insuredName'];
    case 'HEALTH':
    case 'LIFE':
    case 'ACCIDENT':
    default:
      return ['insuranceType', 'whoIsInsured', 'insuredName', 'coveredAge', 'healthOrRiskConditions'];
  }
};
//checks which customer details are collected and which are still missing for the selected insurance category.
const finalizeIntakeState = (rawProfile = {}, categoryOverride = null) => {
  const detectedCategory = rawProfile.insuranceType || categoryOverride || 'HEALTH';
  const requiredSlots = getRequiredSlotsForCategory(detectedCategory);

  const state = {
    insuranceType: rawProfile.insuranceType || categoryOverride || null,
    whoIsInsured: rawProfile.whoIsInsured || null,
    insuredName: rawProfile.insuredName || null,
    coveredAge:
      rawProfile.coveredAge !== null &&
      rawProfile.coveredAge !== undefined &&
      rawProfile.coveredAge !== '' &&
      !Number.isNaN(Number(rawProfile.coveredAge))
        ? Number(rawProfile.coveredAge)
        : null,
    healthOrRiskConditions: rawProfile.healthOrRiskConditions || null,
    selectedPlanName: rawProfile.selectedPlanName || null
  };

  const missingFields = requiredSlots.filter(
    (slot) => state[slot] === null || state[slot] === undefined || state[slot] === ''
  );

  return {
    ...state,
    missingFields,
    nextSlot: missingFields[0] || null,
    completedCount: requiredSlots.length - missingFields.length,
    totalRequired: requiredSlots.length,
    isComplete: missingFields.length === 0
  };
};

const CATEGORY_TITLE_MAP = {
  HEALTH: 'Health Insurance',
  AUTO: 'Car & Motor Insurance',
  HOME: 'Home & Property Insurance',
  LIFE: 'Life Insurance',
  ACCIDENT: 'Personal Accident Insurance',
  AGRICULTURE: 'Agriculture Insurance',
  COMMERCIAL: 'Commercial Insurance',
  TRAVEL: 'Travel Insurance',
  OTHER: 'General Insurance'
};

// saves the user's insurance details to MongoDB as the conversation continues, updating an existing policy record or creating a new one.
export const saveProgressivePolicyToDb = async ({ user, intakeState, selectedOffer = null, question = '' }) => {
  try {
    if (!user?._id || mongoose.connection.readyState !== 1) {
      return { savedPolicy: null, updatedUser: null, dbUpdated: false };
    }

    const hasExtractedData = PRIORITY_SLOTS.some(
      (slot) => intakeState[slot] !== null && intakeState[slot] !== undefined
    );
    if (!hasExtractedData && !selectedOffer) {
      return { savedPolicy: null, updatedUser: null, dbUpdated: false };
    }

    const userDoc = await User.findById(user._id);
    if (!userDoc) return { savedPolicy: null, updatedUser: null, dbUpdated: false };

    if (intakeState.whoIsInsured === 'SELF' && intakeState.coveredAge !== null) {
      userDoc.age = Number(intakeState.coveredAge);
    }

    const validTypes = ['HEALTH', 'AUTO', 'HOME', 'LIFE', 'COMMERCIAL', 'ACCIDENT', 'AGRICULTURE', 'TRAVEL', 'OTHER'];
    const rawCat = (intakeState.insuranceType || selectedOffer?.policyCategory || 'HEALTH').toUpperCase();
    const mappedType = validTypes.includes(rawCat) ? rawCat : 'OTHER';

    const validWho = [
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
    ];
    const rawWho = (intakeState.whoIsInsured || '').trim().toUpperCase();
    let mappedWho = WHO_SYNONYM_MAP[rawWho] || (validWho.includes(rawWho) ? rawWho : (rawWho ? 'OTHER' : ''));

    if (!mappedWho && mappedType === 'COMMERCIAL') mappedWho = 'BUSINESS';

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const cleanTargetName = (intakeState.insuredName || '').trim();

    // Check if user is asking for a new/separate policy
    const isNewPolicyRequested = /\b(separate|another policy|new policy|second policy|2 insurances|two policies|one for.*one for)\b/i.test(question || '');

    let policyDoc = null;

    if (!isNewPolicyRequested) {
      // 1. Try matching by insuredName if available
      if (cleanTargetName) {
        policyDoc = await PolicyDetail.findOne({
          userId: userDoc._id,
          insuranceType: mappedType,
          insuredName: { $regex: `^${cleanTargetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        }).sort({ updatedAt: -1 });
      }

      // 2. Try matching by specific whoIsInsured role
      if (!policyDoc && mappedWho && validWho.includes(mappedWho)) {
        policyDoc = await PolicyDetail.findOne({
          userId: userDoc._id,
          insuranceType: mappedType,
          whoIsInsured: mappedWho,
          status: 'PENDING',
          createdAt: { $gte: twoHoursAgo }
        }).sort({ updatedAt: -1 });
      }

      // 3. Try matching an unassigned pending draft (where insuredName is empty)
      if (!policyDoc) {
        policyDoc = await PolicyDetail.findOne({
          userId: userDoc._id,
          insuranceType: mappedType,
          status: 'PENDING',
          $or: [{ insuredName: '' }, { insuredName: null }, { insuredName: { $exists: false } }],
          createdAt: { $gte: twoHoursAgo }
        }).sort({ updatedAt: -1 });
      }
    }

    // ONLY mark ACTIVE and lock in plan details if the user explicitly selected/enrolled in a plan
    const isEnrolled = Boolean(selectedOffer);
    const status = isEnrolled ? 'ACTIVE' : (policyDoc?.status || 'PENDING');
    const categoryTitle = CATEGORY_TITLE_MAP[mappedType] || `${mappedType} Insurance`;
    const planName = selectedOffer
      ? selectedOffer.planName
      : (policyDoc?.status === 'ACTIVE' && policyDoc?.policyName ? policyDoc.policyName : categoryTitle);
    const sumInsured = selectedOffer
      ? formatAmount(selectedOffer.annualCoverageAmount)
      : (policyDoc?.status === 'ACTIVE' && policyDoc?.sumInsured ? policyDoc.sumInsured : '');
    const premium = selectedOffer
      ? selectedOffer.illustrativePremium
      : (policyDoc?.status === 'ACTIVE' && policyDoc?.premium ? policyDoc.premium : '');

    const effectiveWho = mappedWho || policyDoc?.whoIsInsured || '';
    const finalInsuredName =
      cleanTargetName ||
      policyDoc?.insuredName ||
      (effectiveWho === 'SELF' && intakeState.whoIsInsured === 'SELF' ? userDoc.name || '' : '');
    const finalConditions = intakeState.healthOrRiskConditions || policyDoc?.healthOrRiskConditions || '';

    const notes = [
      finalInsuredName ? `Insured: ${finalInsuredName}` : null,
      finalConditions ? `Conditions/Risks: ${finalConditions}` : null,
      selectedOffer ? `Plan: ${selectedOffer.planName} (${selectedOffer.policyReferenceCode})` : null
    ]
      .filter(Boolean)
      .join(' | ');

    if (policyDoc) {
      policyDoc.policyName = planName;
      if (intakeState.insuranceType || selectedOffer?.policyCategory) {
        policyDoc.insuranceType = mappedType;
      }
      if (effectiveWho) {
        policyDoc.whoIsInsured = effectiveWho;
      }
      if (finalInsuredName) {
        policyDoc.insuredName = finalInsuredName;
      }
      if (intakeState.coveredAge !== null) {
        policyDoc.coveredAge = Number(intakeState.coveredAge);
      }
      if (finalConditions) {
        policyDoc.healthOrRiskConditions = finalConditions;
      }
      if (selectedOffer) {
        policyDoc.sumInsured = sumInsured;
        policyDoc.premium = premium;
      } else if (!isEnrolled && policyDoc.status === 'PENDING') {
        policyDoc.sumInsured = '';
        policyDoc.premium = '';
      }
      policyDoc.status = status;
      policyDoc.notes = notes;
      await policyDoc.save();

      const idx = userDoc.policies.findIndex((p) => p.policyId?.toString() === policyDoc._id.toString());
      if (idx !== -1) userDoc.policies[idx].policyName = planName;
      else userDoc.policies.push({ policyId: policyDoc._id, policyName: planName });
    } else {
      const refPrefix = selectedOffer?.policyReferenceCode || mappedType.slice(0, 4);
      const policyNumber = `POL-${refPrefix}-${Math.floor(1000 + Math.random() * 9000)}`.toUpperCase();

      policyDoc = await PolicyDetail.create({
        userId: userDoc._id,
        policyNumber,
        policyName: planName,
        insuranceType: mappedType,
        whoIsInsured: effectiveWho,
        insuredName: finalInsuredName,
        coveredAge: intakeState.coveredAge !== null ? Number(intakeState.coveredAge) : null,
        healthOrRiskConditions: finalConditions,
        sumInsured,
        policyTerm: '1 Year',
        premium,
        nomineeName: '',
        nomineeRelationship: '',
        status,
        notes
      });

      userDoc.policies.push({ policyId: policyDoc._id, policyName: policyDoc.policyName });
    }

    await userDoc.save();
    const updatedUser = await authService.getUserById(userDoc._id);

    return { savedPolicy: policyDoc, updatedUser, dbUpdated: true };
  } catch (err) {
    console.warn('⚠️ Could not save progressive policy intake to MongoDB:', err.message);
    return { savedPolicy: null, updatedUser: null, dbUpdated: false };
  }
};


export const GENERAL_INSURANCE_INSTRUCTIONS = `You are a warm, knowledgeable, human-like AI Insurance Advisor.

CORE PRINCIPLES & CONVERSATIONAL BEHAVIOR:
1. CONVERSATIONAL NEEDS DISCOVERY FIRST (CHAT & ASSESS BEFORE RECOMMENDING):
   - When a user first comes in with an open-ended question or exploratory inquiry (e.g. "I started a new business with my friend so is there any insurance for me", "I need health insurance for my parents", "How does insurance work?"):
     * CHAT FIRST! Do NOT dump plan cards on the initial inquiry!
     * Warmly and clearly explain how insurance works for their situation, introducing the general types of cover (e.g. for a commercial business: Public Liability, Professional Indemnity, Property/Equipment, Cyber; for health: inpatient/outpatient, pre-existing conditions).
     * Ask natural clarifying questions to discover their needs (e.g. What type of business or industry are you in? What coverage amount or budget do you have in mind? What specific activities or assets are you looking to protect?).
     * CRITICAL: Keep "recommendedPlanCodes" as EMPTY [] during this initial discussion! Do not recommend specific plan cards until the user shares their specific details and preferences.

2. WHEN TO RECOMMEND PLANS (EVIDENCE & REQUIREMENT BASED):
   - Only populate "recommendedPlanCodes" (with 2 to 3 matching policy codes from RELEVANT OFFERS below) when:
     a) The user has provided their details (such as business type/industry, required coverage amount, or for health: family members, ages, health conditions).
     b) OR the user explicitly requests recommendations or quotes (e.g. "Show me the plans", "Recommend plans for me", "Give me quotes", "What plans do you recommend?").
   - Base your recommendations on their stated coverage amount, budget, eligible age, and risk profile.
   - If details are not yet known or the user is just starting the chat, keep "recommendedPlanCodes" as EMPTY [].

3. AI SEMANTIC EXTRACTION & INTAKE (NO HARDCODED ASSUMPTIONS):
   - You must semantically extract intake details directly from what the user expresses:
     * "whoIsInsured": Identify the beneficiary/entity from conversational context ("BUSINESS", "SELF", "FATHER", "MOTHER", "PARENTS", "SPOUSE", "CHILD", "SON", "DAUGHTER", "BROTHER", "SISTER", "GRANDPARENT", etc.).
     * "insuredName": Extract the actual full name of the person or entity mentioned.
     * "coveredAge": Extract their age as an integer whenever mentioned.
     * "healthOrRiskConditions": Semantically extract any health condition, medical history, surgery, chronic illness, medication, or wellness state declared (e.g., "stroke 7 years ago, ongoing medication", "type 2 diabetes", "hypertension", "clean bill of health / no issues"). Do not rely on specific keywords; understand medical context generally.
     * "insuranceType": Accurately classify category ("COMMERCIAL", "HEALTH", "AUTO", "HOME", "LIFE", "ACCIDENT", "AGRICULTURE", "TRAVEL").
   - Adapt what information you collect based on category:
     * **COMMERCIAL**: Focus on Business Name/Entity, Nature of Business / Industry / Activity, and primary risks (Liability, Property, Cyber, Partner protection). DO NOT ask for personal ages or medical history for a commercial property/liability policy!
     * **AUTO**: Focus on Vehicle make/model/year, Driver age/license, and coverage type (Comprehensive vs Third Party).
     * **HOME**: Focus on Property type (house, flat, rented), Buildings vs Contents, and special risks.
     * **HEALTH / LIFE / ACCIDENT**: Focus on Who is covered (self, parents, children, spouse), Names, Ages, and any Pre-existing Health Conditions or medical history.
   - Collect details naturally through ongoing dialogue rather than rigid checklist interrogation. NEVER output numbered checklists (1, 2, 3...) or label steps like "Step 1" or "Priority 1".

4. GROUND TRUTH (DATABASE INTEGRITY & OLD POLICIES CATCH-UP):
   - Check the Existing Customer Information (Ground Truth) provided below! NEVER re-ask for details already saved in Ground Truth or stated earlier in the conversation.
   - If a field is already known, acknowledge it and do not ask again.
   - CATCH UP ON PREVIOUS POLICIES: If the user asks about their old, existing, or enrolled policies (e.g. "tell me about my policy", "what is my policy number?", "what does my enrolled plan cover?", "tell me about dad's policy", "can you explain my old insurance details?"):
     * Review the Ground Truth records provided below.
     * Identify their policy clearly by its Policy Number (e.g. #POL-...), Plan Name, covered person/business, and enrollment status.
     * Thoroughly explain their benefits, coverage limit, premium, pre-existing condition rules, and terms based on Ground Truth and retrieved policy clauses.
     * Do NOT re-enroll them or ask them to re-enter details already recorded.

5. SEPARATE POLICIES FOR MULTIPLE PEOPLE (Health/Personal):
   - If the user wants separate policies for multiple individuals (e.g. mom and dad separately), maintain separate distinct records in "extractedProfiles" (each with their own whoIsInsured, insuredName, coveredAge, and conditions).
   - NEVER mix details between them.

6. PLAN SELECTION & ENROLLMENT (EXCLUSIVE ENROLLMENT):
   - If the user explicitly selects or enrolls in a specific plan (e.g. "Select LiabilityLine", "I choose Meadow Senior Care", "Option 1", "Go with ProSkill", "Select Summit Comprehensive Health"):
     * Set "selectedPlanName" to the exact chosen plan name.
     * If multiple profiles exist in "extractedProfiles", assign "selectedPlanName" specifically to the individual being enrolled (e.g. set Meadow Senior Care on Dad's profile).
     * Congratulate them on selecting that plan, confirm that it is now enrolled for them, and summarize their key coverage benefits (limit, deductible, monthly premium).
     * CRITICAL: Set "recommendedPlanCodes" as EMPTY []! Once a plan is chosen/enrolled, do NOT show other unselected recommendations.
   - If the user has NOT explicitly chosen a plan yet, keep "selectedPlanName" as null.

7. STRICTLY NO TECHNICAL JARGON:
   - Never mention internal technical terms like database, Qdrant, chunks, vectors, embeddings, or JSON.

Respond strictly in JSON:
{
  "answer": "<Warm, human-like, informative reply answering user's question, introducing relevant coverage types, and gently guiding next steps>",
  "confidence": "HIGH" | "MEDIUM" | "LOW" | "NOT_FOUND",
  "suggestedFollowUps": ["<Relevant follow-up question 1>", "<Relevant follow-up question 2>"],
  "extractedProfile": {
    "insuranceType": "COMMERCIAL" | "HEALTH" | "AUTO" | "HOME" | "LIFE" | "ACCIDENT" | "AGRICULTURE" | "TRAVEL" | null,
    "whoIsInsured": "BUSINESS" | "SELF" | "SPOUSE" | "FATHER" | "MOTHER" | "PARENTS" | "CHILD" | "OTHER" | null,
    "insuredName": "string or null",
    "coveredAge": null,
    "healthOrRiskConditions": "string or null",
    "selectedPlanName": "string or null"
  },
  "extractedProfiles": [],
  "recommendedPlanCodes": []
}`;

// Unified Insurance AI RAG Agent powered by Qdrant/MongoDB semantic search & Groq LLM with multi-turn memory
export const answerInsuranceQuery = async ({
  question,
  conversationHistory = [],
  policyTypeFilter = null,
  policyCodeFilter = null,
  planNameFilter = null,
  user = null
}) => {
  const askedForTable = /\b(table|tabular|columns|grid|matrix)\b/i.test(question || '');
  const trimmed = (question || '').trim().toLowerCase();
  const isSinglePlanMode = Boolean(policyCodeFilter || planNameFilter);

  // Fetch user policies ONCE upfront to eliminate redundant database calls across the function
  const allUserPolicies =
    user?._id && mongoose.connection.readyState === 1
      ? await PolicyDetail.find({ userId: user._id }).sort({ createdAt: -1 })
      : [];

  // Resolve target single offer if policyCodeFilter or planNameFilter was passed
  let targetOffer = null;
  if (policyCodeFilter) {
    targetOffer = await PolicyOffer.findOne({
      policyReferenceCode: { $regex: `^${policyCodeFilter.trim()}$`, $options: 'i' }
    });
  } else if (planNameFilter) {
    const cleanName = planNameFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
    targetOffer = await PolicyOffer.findOne({
      planName: { $regex: cleanName, $options: 'i' }
    });
  }

  // Gracefully handle common greetings and orientation questions with clean, concise payload
  const isGreeting = /^(hi+|hello+|hey+|good\s+(morning|afternoon|evening)|help|greetings|who\s+are\s+you|what\s+can\s+you\s+do)[\s!.,?]*$/i.test(trimmed);
  if (isGreeting) {
    const firstName = user?.name ? user.name.split(' ')[0] : '';
    return {
      queryId: `greeting_${Date.now()}`,
      question,
      answer: targetOffer
        ? `👋 **Hello${firstName ? ` ${firstName}` : ''}!** I am your dedicated advisor for **${targetOffer.planName}** (by ${targetOffer.insurer}).\n\nAsk me anything about this plan's coverage limit, eligible age range, monthly premium, deductible, waiting periods, or exclusions.`
        : `Hello${firstName ? ` ${firstName}` : ''}! 👋 I'm your AI Insurance Advisor. How can I help you today? Tell me what type of insurance you are looking for (such as Health, Car/Motor, Home, Life, Personal Accident, Agriculture, or Commercial).`,
      confidence: 'HIGH',
      userPolicies: allUserPolicies,
      recommendedOffers: [],
      suggestedFollowUps: [],
      createdAt: new Date().toISOString()
    };
  }

  // 1. AI Intent Classification, Contextual Query Rewriting, and Category Classification
  const aiContext = await classifyAndContextualizeWithAI({
    question,
    conversationHistory,
    policyTypeFilter
  });

  const contextualSearchQuery = aiContext.standaloneSearchQuery || question;
  const isPersonalIntake = aiContext.isPersonalIntakeOrAction;
  const detectedCategory = aiContext.detectedCategory;

  // 2. Retrieve top matching official insurance policy clauses & offers from Qdrant / MongoDB Vector Store
  let retrievedPoints = [];
  if (targetOffer) {
    retrievedPoints = [
      {
        id: targetOffer.qdrantPointId || `offer_${targetOffer._id}`,
        score: 1.0,
        payload: {
          policyOfferId: targetOffer._id.toString(),
          title: `${targetOffer.planName} (${targetOffer.insurer})`,
          planName: targetOffer.planName,
          insurer: targetOffer.insurer,
          policyType: targetOffer.policyCategory,
          policyCode: targetOffer.policyReferenceCode,
          sectionTitle: `${targetOffer.policyCategory} Plan • ${targetOffer.coverageSubtype || 'Standard'}`,
          content: targetOffer.chunkText || formatPolicyOfferText(targetOffer)
        }
      }
    ];
  } else {
    try {
      const filter = policyTypeFilter && policyTypeFilter !== 'ALL'
        ? { policyType: policyTypeFilter }
        : (detectedCategory && detectedCategory !== 'GENERAL' ? { policyType: detectedCategory } : null);

      retrievedPoints = await searchSimilarPolicyClauses(contextualSearchQuery, 6, filter);
      if ((!retrievedPoints || retrievedPoints.length === 0) && filter) {
        retrievedPoints = await searchSimilarPolicyClauses(contextualSearchQuery, 6, null);
      }
    } catch (searchErr) {
      console.warn('⚠️ Vector search notice:', searchErr.message);
    }
  }

  const citedClauses = [];
  let contextText = '';

  if (retrievedPoints && retrievedPoints.length > 0) {
    const topPoints = retrievedPoints.slice(0, 4);
    contextText = topPoints
      .map((p, idx) => {
        const payload = p.payload || {};
        citedClauses.push({
          policyTitle: payload.title || payload.planName || 'Insurance Policy',
          insurer: payload.insurer || 'General Insurer',
          policyCode: payload.policyCode || payload.policyReferenceCode || '',
          policyType: payload.policyType || payload.policyCategory || 'GENERAL',
          version: payload.version || '1.0',
          contentSnippet: (payload.content || '').slice(0, 250),
          relevanceScore: Math.round((p.score || p.hybridScore || 0) * 100) / 100
        });

        const snippet = (payload.content || '').trim().slice(0, 500);
        return `[SOURCE ${idx + 1}] (${payload.policyCode || payload.policyReferenceCode || 'N/A'} - ${payload.title || payload.planName || 'Insurance Plan'})
Category: ${payload.policyType || payload.policyCategory || 'GENERAL'}
Section: ${payload.sectionTitle || 'Policy Schedule'}
Text:
${snippet}
`;
      })
      .join('\n---\n\n');
  } else {
    // If not found in vector search, LLM handles answering directly using general insurance domain knowledge
    contextText = 'No specific matching policy clauses were found in the knowledge base for this query. As an expert Insurance AI Advisor, answer the user accurately using general insurance domain knowledge and provide clear guidance.';
  }

  // Build Persistent Ground Truth using the already-fetched allUserPolicies from MongoDB
  let userPoliciesGroundTruth = '';
  if (allUserPolicies.length > 0) {
    const policyLines = allUserPolicies
      .map((p, i) => {
        return `- Policy #${i + 1}:
  * Policy Number: ${p.policyNumber || 'N/A'}
  * Plan Name: "${p.policyName || 'Standard Insurance Plan'}"
  * Insurance Category: ${p.insuranceType || 'HEALTH'}
  * Covered Person/Role: ${p.whoIsInsured || 'SELF'} (Full Name: "${p.insuredName || 'N/A'}")
  * Covered Age: ${p.coveredAge ?? 'N/A'}
  * Health / Risk Factors: "${p.healthOrRiskConditions || 'None reported'}"
  * Sum Insured / Limit: ${p.sumInsured || 'Standard plan limit'}
  * Monthly/Annual Premium: ${p.premium || 'Standard rate'}
  * Policy Term: ${p.policyTerm || '1 Year'}
  * Enrollment Status: ${p.status}`;
      })
      .join('\n\n');

    userPoliciesGroundTruth = `CURRENT RECORDED POLICIES ALREADY SAVED IN DATABASE (GROUND TRUTH - NEVER FORGET OR RE-ASK FOR THESE):
${policyLines}

CRITICAL CONVERSATIONAL RULES REGARDING GROUND TRUTH & EXISTING POLICIES:
1. NEVER re-ask for details already captured in the Ground Truth above!
- If Category is recorded (e.g. COMMERCIAL or HEALTH), you ALREADY know what insurance they have. NEVER ask what type of insurance they want!
- If Insured Names are recorded (e.g. Maria David Joseph, David Joseph, or a Business Name), you ALREADY know their names. NEVER ask for their names again!
- If their ages or health conditions are recorded, do NOT ask for them again.
2. CATCH UP ON PREVIOUS POLICIES: If the user asks to catch up, review, or know more about their existing/old policy (e.g. "tell me about my policy", "what is my policy number?", "what does my enrolled plan cover?", "tell me about dad's policy", "explain my old policy details"):
- Review the Ground Truth records above.
- Identify the policy clearly by its Policy Number (e.g. #POL-...), Plan Name, covered person/business, and enrollment status.
- Thoroughly and helpfully explain their benefits, limits, premiums, and coverage features using the Ground Truth and retrieved document clauses.
3. If all fields for a person are recorded in the Ground Truth, DO NOT interrogate them. Answer their questions directly or guide their next inquiry naturally.`;
  }

  const model = env.GROQ_MODEL;

  // Message Assembly
  let existingCustomerInfo = `Customer Name: ${user?.name || 'Customer'}`;
  if (targetOffer) {
    existingCustomerInfo += `\nSelected Target Plan: "${targetOffer.planName}" (${targetOffer.policyReferenceCode || 'N/A'}) by ${targetOffer.insurer || 'Carrier'}`;
  }
  if (userPoliciesGroundTruth) {
    existingCustomerInfo += `\n\n${userPoliciesGroundTruth}`;
  }

  const retrievedContext = contextText && contextText.trim().length > 0
    ? contextText
    : 'No specific policy clauses retrieved for this query. Rely on general insurance domain knowledge and clarify with the user.';

  const recentHistory = conversationHistory.slice(-30);
  const historyMessages = [];
  for (const m of recentHistory) {
    if (m.role === 'user' && m.content) {
      historyMessages.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant' && m.content) {
      historyMessages.push({
        role: 'assistant',
        content: JSON.stringify({ answer: (m.content || '').slice(0, 650) })
      });
    }
  }

  const groqMessages = [
    { role: 'system', content: GENERAL_INSURANCE_INSTRUCTIONS },
    ...historyMessages,
    {
      role: 'user',
      content: `User question: ${question}\n\nExisting customer information:\n${existingCustomerInfo}\n\nRelevant retrieved policy information:\n${retrievedContext}`
    }
  ];

  let answer = '';
  let confidence = 'HIGH';
  let suggestedFollowUps = [];
  let extractedProfile = {};
  let extractedProfiles = [];
  let recommendedPlanCodes = [];
  let durationMs = 0;

  // 4. Single Unified Groq LLM Call (with automatic retry if Groq TPM rate limit window is briefly hit)
  const groq = getGroqClient();
  const startTime = Date.now();
  try {
    const completion = await createGroqCompletionWithRetry(groq, {
      model,
      messages: groqMessages,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    durationMs = Date.now() - startTime;

    let raw = completion?.choices?.[0]?.message?.content || '{}';
    raw = raw.replace(/```json\s*|```\s*$/g, '').trim();
    const parsed = JSON.parse(raw);

    const rawAnswer = parsed.answer || 'How can I help you with your insurance coverage today?';
    answer = formatConciseWidgetAnswer(rawAnswer, askedForTable);
    confidence = parsed.confidence || 'HIGH';
    extractedProfile = parsed.extractedProfile || {};
    extractedProfiles = Array.isArray(parsed.extractedProfiles) ? parsed.extractedProfiles : [];
    recommendedPlanCodes = Array.isArray(parsed.recommendedPlanCodes) ? parsed.recommendedPlanCodes : [];

    if (Array.isArray(parsed.suggestedFollowUps)) {
      suggestedFollowUps = parsed.suggestedFollowUps
        .filter((q) => typeof q === 'string' && q.trim().length > 8)
        .map((q) => q.replace(/^\d+[\.\)]\s*|^[-*•]\s*/, '').trim());
    }
  } catch (error) {
    durationMs = Date.now() - startTime;
    console.warn('Groq LLM call failed or returned non-JSON:', error.message);
    answer = targetOffer
      ? `${targetOffer.planName} (${targetOffer.insurer}) provides up to ${formatAmount(targetOffer.annualCoverageAmount)} coverage at ${targetOffer.illustrativePremium}.`
      : 'Could you please tell me what type of insurance you are looking for today?';
    confidence = 'MEDIUM';
  }

  // 5. Finalize intake state, resolve recommended offers from DB, and progressively update MongoDB
  const intakeState = finalizeIntakeState(extractedProfile);
  let recommendedOffers = [];
  let savedPolicy = null;
  let updatedUser = null;
  let dbUpdated = false;

  if (!isSinglePlanMode) {
    const allActiveOffers = await PolicyOffer.find({ status: 'ACTIVE' }).select('-vector');

    // Resolve explicit user plan selection
    let selectedPlanOffer = null;
    const planCandidate = aiContext.selectedPlanName || intakeState.selectedPlanName;

    if (planCandidate) {
      const cleanCandidate = String(planCandidate).toLowerCase().trim();
      selectedPlanOffer =
        allActiveOffers.find((o) =>
          o.planName.toLowerCase().includes(cleanCandidate) ||
          cleanCandidate.includes(o.planName.toLowerCase()) ||
          o.policyReferenceCode.toLowerCase() === cleanCandidate
        ) || null;

      if (!selectedPlanOffer) {
        const optMatch = cleanCandidate.match(/\b(?:option|plan|choice)\s*([1-5])\b/i);
        if (optMatch && recommendedPlanCodes.length > 0) {
          const idx = parseInt(optMatch[1], 10) - 1;
          const targetCode = recommendedPlanCodes[idx];
          if (targetCode) {
            selectedPlanOffer = allActiveOffers.find((o) => o.policyReferenceCode.toLowerCase() === targetCode.toLowerCase()) || null;
          }
        }
      }
    }

    if (!selectedPlanOffer && (aiContext.intent === 'PLAN_SELECTION' || intakeState.selectedPlanName)) {
      for (const offer of allActiveOffers) {
        if (question.toLowerCase().includes(offer.planName.toLowerCase()) ||
            question.toLowerCase().includes(offer.policyReferenceCode.toLowerCase())) {
          selectedPlanOffer = offer;
          break;
        }
      }
    }

    if (selectedPlanOffer) {
      // User enrolled! Only return the chosen plan
      recommendedOffers = [selectedPlanOffer];
    } else {
      // Evidence-based plan recommendations
      const activeCategory =
        intakeState.insuranceType ||
        extractedProfile.insuranceType ||
        (detectedCategory && detectedCategory !== 'GENERAL' ? detectedCategory : null);

      if (activeCategory && !intakeState.insuranceType) {
        intakeState.insuranceType = activeCategory;
      }

      const isExplicitPlanRequest = /\b(show\s+(?:me\s+)?(?:the\s+)?(?:plans|quotes|options)|recommend\s+(?:me\s+)?(?:a\s+)?plan|give\s+(?:me\s+)?(?:some\s+)?quotes|which\s+plan\s+should|what\s+plans\s+can\s+i\s+choose|available\s+plans\s+to\s+select|what\s+are\s+the\s+plans|options\s+to\s+choose)\b/i.test(question || '');

      const hasSubstantiveDetails =
        intakeState.isComplete ||
        (intakeState.insuranceType === 'COMMERCIAL' && (intakeState.insuredName || intakeState.whoIsInsured)) ||
        (['HEALTH', 'LIFE', 'ACCIDENT'].includes((activeCategory || '').toUpperCase()) && (intakeState.coveredAge || intakeState.healthOrRiskConditions));

      const isEarlyTurn = (!conversationHistory || conversationHistory.length <= 1) && !isExplicitPlanRequest && !hasSubstantiveDetails;

      const shouldRecommend = !isEarlyTurn && (
        isExplicitPlanRequest ||
        (recommendedPlanCodes.length > 0 && hasSubstantiveDetails) ||
        intakeState.isComplete
      );

      if (shouldRecommend) {
        const catUpper = activeCategory && activeCategory !== 'ALL' ? activeCategory.toUpperCase() : null;
        const matchingCategoryOffers = catUpper
          ? allActiveOffers.filter((o) => o.policyCategory?.toUpperCase() === catUpper)
          : allActiveOffers;
        const categoryOffers = matchingCategoryOffers.length > 0 ? matchingCategoryOffers : allActiveOffers;

        const isPersonalCategory = ['HEALTH', 'LIFE', 'ACCIDENT'].includes((activeCategory || '').toUpperCase());
        const ageEligible = (isPersonalCategory && intakeState.coveredAge)
          ? categoryOffers.filter((o) => {
              const min = o.minimumEntryAge ?? 18;
              const max = o.maximumEntryAge ?? 75;
              return intakeState.coveredAge >= min && intakeState.coveredAge <= max;
            })
          : categoryOffers;

        const pool = ageEligible.length > 0 ? ageEligible : categoryOffers;

        let candidateOffers = [];
        if (recommendedPlanCodes.length > 0) {
          const byCode = recommendedPlanCodes
            .map((code) => allActiveOffers.find((o) => o.policyReferenceCode.toLowerCase() === String(code).toLowerCase().trim()))
            .filter(Boolean);
          const remaining = pool.filter((o) => !byCode.some((b) => b.policyReferenceCode === o.policyReferenceCode));
          candidateOffers = [...byCode, ...remaining];
        } else {
          candidateOffers = pool;
        }

        const seenCodes = new Set();
        recommendedOffers = candidateOffers
          .filter((o) => {
            if (!o || seenCodes.has(o.policyReferenceCode)) return false;
            seenCodes.add(o.policyReferenceCode);
            return true;
          })
          .slice(0, 3);
      }
    }

    // Handle profiles and progressive saving
    const multiProfiles =
      extractedProfiles.length > 0
        ? extractedProfiles
        : Object.keys(extractedProfile).length > 0
          ? [extractedProfile]
          : [];

    if (multiProfiles.length > 1) {
      for (const prof of multiProfiles) {
        const fullProf = {
          insuranceType: prof.insuranceType || intakeState.insuranceType || 'HEALTH',
          ...prof
        };
        const profileOffer = prof.selectedPlanName
          ? allActiveOffers.find((o) =>
              o.planName.toLowerCase().includes(prof.selectedPlanName.toLowerCase()) ||
              o.policyReferenceCode.toLowerCase() === prof.selectedPlanName.toLowerCase()
            ) || selectedPlanOffer
          : selectedPlanOffer;

        const pState = finalizeIntakeState(fullProf);
        const res = await saveProgressivePolicyToDb({
          user,
          intakeState: pState,
          selectedOffer: profileOffer,
          question
        });
        if (res.savedPolicy) {
          savedPolicy = res.savedPolicy;
          updatedUser = res.updatedUser;
          dbUpdated = true;
        }
      }
    } else {
      const dbResult = await saveProgressivePolicyToDb({
        user,
        intakeState,
        selectedOffer: selectedPlanOffer,
        question
      });
      savedPolicy = dbResult.savedPolicy;
      updatedUser = dbResult.updatedUser;
      dbUpdated = dbResult.dbUpdated;
    }
  }

  // Refresh user policies only if a database write occurred, otherwise reuse allUserPolicies
  const finalUserPolicies = dbUpdated && user?._id && mongoose.connection.readyState === 1
    ? await PolicyDetail.find({ userId: user._id }).sort({ createdAt: -1 })
    : allUserPolicies;

  return {
    queryId: `rag_${Date.now()}`,
    question,
    answer,
    citedClauses,
    confidence,
    suggestedFollowUps,
    intakeState,
    recommendedOffers,
    savedPolicy,
    updatedUser,
    userPolicies: finalUserPolicies,
    dbUpdated,
    model,
    isCached: false,
    durationMs,
    createdAt: new Date().toISOString()
  };
};
