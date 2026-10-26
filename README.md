# Insurance AI Agent — Autonomous Conversational Advisory, Multi-Product Rate Catalogues & Enterprise RAG Platform

**Insurance AI Agent** is a production-grade, enterprise-scale AI intelligence platform engineered specifically for **Autonomous Insurance Advisory, Conversational Risk Discovery, Multi-Product Rate Catalogues, First Notice of Loss (FNOL) Claims Adjudication, and Statutory Insurance Governance**. 

The platform supports **10 comprehensive insurance lines**:
1. **Auto & Motor Cover**
2. **Health & Medical Cover**
3. **Home & Property Cover**
4. **Life & Annuity**
5. **Commercial & Business Liability**
6. **Personal Accident**
7. **Agriculture & Crop Cover**
8. **Travel & International Assistance**
9. **Directors & Officers / Professional Liability**
10. **General & Marine Transit / Asset Protection**

---

## 🌟 Key Architectural Capabilities

### 1. Pure NLP Conversational Intake (No Rigid Scripts)
- **Native Natural Language Processing (NLP)**: Understands customer intent, context, and domain nuances using Groq LPU inference (`openai/gpt-oss-120b`). Replaces brittle regular expressions with semantic intent extraction.
- **Intelligent Intake Extraction**: Dynamically parses conversational parameters (who is insured, names, ages, vehicle details, health condition status, property features, business turnover) directly into structured JSON entities.

### 2. Strict Privacy & Sensitive KYC Document Routing
- **Conversational vs Sensitive Isolation**: Distinguishes between conversational parameters (needed for initial quote estimation) and confidential KYC/legal documents.
- **Zero Confidential Leaks**: The advisor strictly avoids asking users to paste sensitive identity numbers or private documents into chat. If a user asks about sharing documents (such as **Aadhaar, PAN, vehicle RC copy, engine/chassis numbers, bank details, or tax returns**), the advisor automatically directs them to complete and upload them securely in their dedicated **Profile & Documents portal** (`/profile`).

### 3. Gated 6-Offer Grounded Recommendation Engine
- **Intake Completeness Gate**: Policy recommendation cards are strictly locked until the customer has shared the required conversational parameters for their domain.
- **Courteous Early Handling**: If a user asks *"give me recommendations"* or *"show me plans"* before providing their details, the advisor warmly replies:
  > *"I will gladly give you recommendations, but first please answer some questions so I can match you with the right policy for your needs."*
  and prompts for the missing parameters.
- **Intelligent 6-Offer Selection**: Once unlocked, the engine retrieves **6 recommendations** formatted for a responsive 2×3 card grid:
  - **Category Isolation**: Strictly isolates offers from the active domain (`AUTO`, `HEALTH`, etc.).
  - **Age Eligibility Filtering**: Strictly verifies `minimumEntryAge <= userAge <= maximumEntryAge`, eliminating ineligible plans.
  - **Underwriting Alignment**: Rewards matches on vehicle specifications (e.g. Electric Vehicle / Tesla bonuses), pre-existing condition terms, senior care, and commercial fleet needs.
  - **Catalog Backfill**: For specialized categories with fewer than 6 plans in catalog (e.g. `HOME`, `TRAVEL`), backfills the remaining slots with the highest-matching compatible `GENERAL` plans.

### 4. Progressive CRUD Policy Persistence
- **Zero Data Loss Architecture**: Tightly integrated with `policyDetailService` to load database Ground Truth (`getUserPolicies`) before every turn and progressively create or update pending/active policy drafts in MongoDB (`createPolicy` / `updatePolicy`).
- **Target Policy Focus**: When launching a chat from a specific catalog plan, the advisor operates in dedicated 1-on-1 mode, answering limits, deductibles, waiting periods, and exclusions specifically for that target policy.

### 5. Multi-Source Ingestion & Hybrid Vector RAG
- **Two-Tier Spreadsheet Disaggregation**: Automatically ingests multi-product Excel workbooks (e.g. `30_fictional_insurance_offers.xlsx`), decomposes every row into an independent `PolicyOffer` record, assigns enterprise policy codes (`POL-AUTO-001`, `POL-HLTH-002`), and indexes dedicated vector points.
- **5 Ingestion Guardrails**: SHA-256 deduplication, multi-format text extraction (PDF, DOCX, XLSX, CSV), 4-point stratified sampling, insurance domain density analyzer, and AI Gatekeeper authenticity evaluation.
- **100% Local ONNX Embeddings**: Runs `all-MiniLM-L6-v2` locally on CPU via `@huggingface/transformers` ($0 external embedding cost, strict data sovereignty).
- **Qdrant Vector Hybrid Retrieval**: High-precision vector cosine similarity with 8-signal domain re-ranking (+15.0 exact clause match, +6.0 exclusions, +5.5 deductibles).

---

## 📑 Technical Architecture & Documentation PDF

Complete technical reports and architectural specifications are available directly in this repository:
- 📕 **Official Architecture & Orchestration Guide:** [`insurance_ai_agent_architecture_orchestration.md`](./insurance_ai_agent_architecture_orchestration.md)
- 📄 **Markdown Architecture & Pipeline Guide:** [`docs/RAG_ARCHITECTURE_AND_PIPELINE.md`](./docs/RAG_ARCHITECTURE_AND_PIPELINE.md)
- 📊 **Excel Batch Ingestion Spec:** [`docs/excel_batch_ingestion_and_policy_offers_architecture.md`](./docs/excel_batch_ingestion_and_policy_offers_architecture.md)

---

## 1. Technology Stack & Architecture Matrix

| Layer | Technology | Implementation Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + Vite 5 | SPA running on `http://localhost:8080` with API proxy to `:5000` |
| **UI Design System** | Tailwind CSS v3.4 | Enterprise Dark Slate & Sky Blue theme (`#0f172a` Slate, `#0284c7` Sky, `#10b981` Emerald, `#f59e0b` Amber) |
| **HTTP Client** | Axios v1.7 | Global auth interceptor with automatic Bearer token injection and error handling |
| **Backend Framework** | Node.js (v22+) + Express 5 | ES Modules (`"type": "module"`), REST API on `http://localhost:5000/api` |
| **Primary Database** | MongoDB + Mongoose v8.9 | Database: `insurance_ai_agent` (`users`, `policydetails`, `policyoffers`, `policydocuments`) |
| **Vector Database** | Qdrant (`localhost:6333`) | Collection: `insurance_policy_rules` (384-dim Cosine distance) with payload filtering |
| **Local Embeddings** | `Xenova/all-MiniLM-L6-v2` | 100% local CPU ONNX inference via `@huggingface/transformers` (`384-dim`, **$0 token cost**) |
| **Large Language Model** | Groq LPU Inference | `openai/gpt-oss-120b` (or `llama-3.3-70b-versatile`) with structured JSON response contract |
| **Policy CRUD Service** | `policyDetailService` | Complete lifecycle management (create, read, update, delete, user sync) |
| **Tabular Disaggregation** | SheetJS (`xlsx`) + Parser | Ingests `.xlsx`, `.xls`, `.csv`, auto-extracts individual policies, assigns standardized reference codes |

---

## 2. End-to-End System Pipeline

```
USER CLIENT (BROWSER - Port 8080)
(React 18 + Vite + Tailwind CSS — Auth UI, Policy Vault, Granular Offers Catalog, ChatGPT-style AI Advisor)
 │
 ▼
EXPRESS 5 REST API GATEWAY (Port 5000)
 │
 ├───────────────────────────┬───────────────────────────┬───────────────────────────┬───────────────────────────┐
 ▼                           ▼                           ▼                           ▼                           ▼
PRE-RAG FILTRATION          SPREADSHEET DISAGGREGATION  CONVERSATIONAL RAG ADVISOR  POLICY CRUD SERVICES        CATALOG & VECTOR SYNC
1. Cryptographic SHA-256    1. SheetJS Workbook Parser  1. Ground Truth (DB sync)   1. policyDetailService      1. /api/offers CRUD
2. Multi-Format Text Parser 2. Decomposes 30+ Offers    2. Sliding Window (16 msgs) 2. MongoDB PolicyDetail     2. Qdrant Point Upsert
   (PDF, DOCX, XLSX, CSV)   3. Standard Policy Codes    3. Qdrant Semantic Search   3. Progressive Draft Save   3. Selective Vector
3. 4-Point Stratified Sample   (e.g., POL-AUTO-001)     4. 10-Domain NLP Extraction 4. User Policy Array Sync      Re-embedding on Edit
4. Domain Density Analyzer  4. Stores PolicyOffer in DB 5. KYC Privacy Separation   5. Real-Time Intake State   4. Deletion Cascade
5. AI Gatekeeper Validation 5. Indexes Dedicated Vector 6. 6-Offer Gated Recs Engine
```

---

## 3. The 10 Insurance Domain Specifications

| # | Domain Category | Conversational Parameters (In-Chat Discovery) | Sensitive KYC & Official Documents (Direct to Profile) |
| :- | :--- | :--- | :--- |
| **1** | **AUTO (Motor)** | Driver age, vehicle make/model/variant/year, coverage type (Comprehensive vs Third-Party), usage (personal vs commercial), driving history & NCB %. | Vehicle Registration Certificate (RC copy), Engine & Chassis numbers, vehicle inspection photos/video. |
| **2** | **HEALTH** | Ages and genders of members, pre-existing conditions (diabetes, hypertension, surgeries, or "None"), smoking/lifestyle, preferred coverage tier. | Aadhaar, PAN, Passport copies, prior medical records, discharge summaries, pre-policy checkup reports. |
| **3** | **HOME** | Property type (house, flat, villa), building age, square footage/bedrooms, location, basic security (fire alarm, gated community). | Sale deed, property tax receipt, title deed, structural valuation certificates, interior photos. |
| **4** | **LIFE** | Insured age, smoking/tobacco status, broad annual income, occupation type, nominee relation, desired sum assured. | Aadhaar, PAN, salary slips, Form 16, ITR copies, detailed clinical diagnostics (blood, ECG). |
| **5** | **COMMERCIAL** | Nature of business trade, industry classification, estimated turnover, employee headcount, core risk priorities (liability, fleet, property). | GSTIN, PAN, incorporation certificate, trade license, audited balance sheets, safety audit clearances. |
| **6** | **ACCIDENT** | Insured age, occupation risk classification (desk job vs field/machinery), pre-existing physical disabilities. | Government identity proofs, Nominee official ID proofs. |
| **7** | **AGRICULTURE** | Crop type cultivated, approximate acreage, sowing timeline, irrigation source (rainfed vs canal). | Land title deed (Khata / 7/12 extract), patwari/panchayat sowing certificate, bank account details for subsidies. |
| **8** | **TRAVEL** | Destination countries, trip dates/duration, traveler age, purpose of trip (leisure, business, adventure sports). | Passport copies, visa documents, flight ticket itineraries, boarding passes. |
| **9** | **LIABILITY** | Scope of professional services, product lines, geographic spread (domestic vs USA/export), prior claims history. | Incorporation documents, audited financial statements, standard client service contracts. |
| **10** | **GENERAL** | Precise asset/event description, coverage term, desired deductible/excess. | Original purchase invoices, valuation bills, customs/transit documents. |

---

## 4. Role-Based Access Control (RBAC) System

The platform supports 3 primary enterprise roles:

| Role | Target Persona | Domain Specific Fields | Permissions & Access |
| :--- | :--- | :--- | :--- |
| **`COMPANY_ADMIN`** | Insurance Firm Executive / IT Admin | `employeeId`, `department` *(Executive Administration)* | Full access: User Management, Master Document Ingestion, Batch Disaggregation, Granular Policy Editing, Vector Deletion. |
| **`UNDERWRITER`** / **`EMPLOYEE`** | Claims Adjuster / Underwriter | `employeeId`, `department` *(Claims & Underwriting)* | Access to Policy Offers Catalog, inline policy editing, vector re-sync, claims underwriting tools. |
| **`POLICYHOLDER`** | Customer / Client | `customerId`, `policyNumber`, `city`, `pincode` | AI Advisor chat, profile & KYC document vault, policy management, favorites, quote comparisons. |

---

## 5. Repository Structure

```
Insurance-AI-Agent/
├── Backend/                                  # Node.js 22+ & Express 5 (ES Modules)
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js                        # Environment loader with Zod validation
│   │   │   └── db.js                         # Mongoose connection to MongoDB (insurance_ai_agent)
│   │   ├── controllers/
│   │   │   ├── auth.controller.js            # User signup, login, profile fetch, profile update
│   │   │   ├── policyDetail.controller.js    # CRUD handlers for user PolicyDetail records
│   │   │   ├── policyDocument.controller.js  # Upload, Gatekeeper polling & master document vault
│   │   │   ├── policyOffer.controller.js     # Granular policy offer CRUD & vector sync
│   │   │   └── ragAgent.controller.js        # RAG Advisor chat & semantic search handlers
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js            # JWT verification and role-based access control
│   │   │   ├── error.middleware.js           # Centralized API error handler
│   │   │   └── upload.middleware.js          # Multer memory storage (PDF, DOCX, XLSX, CSV)
│   │   ├── models/
│   │   │   ├── user.model.js                 # User identity, credentials, consent flags, and role
│   │   │   ├── policyDetail.model.js         # Enrolled policy instances (who, age, conditions, limits)
│   │   │   ├── policyOffer.model.js          # Commercial insurance catalog plans (pricing, benefits)
│   │   │   └── policyDocument.model.js       # Master ingested policy documents & catalogues
│   │   ├── routes/
│   │   │   ├── auth.routes.js                # /api/auth
│   │   │   ├── policyDetail.routes.js        # /api/policies
│   │   │   ├── policyOffer.routes.js         # /api/offers & /api/policy-offers
│   │   │   ├── policyDocument.routes.js      # /api/documents & /api/policy-documents
│   │   │   └── ragAgent.routes.js            # /api/agent & /api/rag
│   │   ├── services/
│   │   │   ├── ragAgent.service.js           # Unified NLP RAG engine, intake parsing, 6-offer ranking
│   │   │   ├── policyDetail.service.js       # Pure CRUD lifecycle for user policies
│   │   │   ├── policyOffer.service.js        # Workbook disaggregation & single-policy vector sync
│   │   │   ├── policyDocument.service.js     # Master document ingestion orchestration
│   │   │   ├── qdrant.service.js             # Qdrant client connection & collection management
│   │   │   ├── vectorStore.service.js        # Document chunking & 8-signal hybrid re-ranking
│   │   │   ├── fileParser.service.js         # PDF, Word, and Excel row flattening
│   │   │   ├── insuranceParser.service.js    # Regex pattern extraction of policy numbers, dates, limits
│   │   │   ├── aiGatekeeper.service.js       # 4-point stratified sampling & domain density analyzer
│   │   │   ├── aiProvider.service.js         # Local Xenova MiniLM embeddings & Groq client
│   │   │   └── auth.service.js               # Password hashing, token generation, user lookup
│   │   ├── utils/
│   │   │   ├── apiError.js                   # Standardized error exceptions
│   │   │   ├── apiResponse.js                # Standardized JSON responses
│   │   │   ├── asyncHandler.js               # Automatic async try/catch wrapper
│   │   │   └── jwt.js                        # JWT signing and verification
│   │   ├── app.js                            # Express app bootstrap & route registration
│   │   └── server.js                         # Port 5000 bootstrap & vector collection init
│   ├── .env                                  # Environment variables
│   └── package.json                          # Backend dependencies
│
├── Frontend/                                 # React 18 + Vite 5 + Tailwind CSS + Axios
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js                     # Axios instance with auth interceptor
│   │   │   ├── auth.api.js                   # Authentication & user management API calls
│   │   │   ├── policy.api.js                 # PolicyDetail API calls (get, update, delete)
│   │   │   └── documents.api.js              # Documents, Policy Offers, and RAG Copilot calls
│   │   ├── components/
│   │   │   ├── Navbar.jsx                    # Responsive navigation header with user profile menu
│   │   │   ├── ChatMessageRenderer.jsx       # Markdown renderer for AI messages (headings, lists, bold)
│   │   │   ├── PolicyOffersCatalog.jsx       # Grid of insurance plan cards with filter tabs & search
│   │   │   ├── PlanDetailsModal.jsx          # Modal detailing specific coverage, deductibles, exclusions
│   │   │   ├── EditPolicyOfferModal.jsx      # Admin modal to edit policy terms & re-sync vectors
│   │   │   ├── DeleteConfirmModal.jsx        # Confirmation modal for irreversible deletion actions
│   │   │   └── AiGatekeeperModal.jsx         # Upload progress & gatekeeper evaluation modal
│   │   ├── pages/
│   │   │   ├── HomePage.jsx                  # Landing page with core value props and quick links
│   │   │   ├── InsurancePage.jsx             # Product catalog page with category filtering & "Talk to Agent"
│   │   │   ├── AiChatPage.jsx                # Multi-session AI Advisor with policy resumption & 2x3 cards
│   │   │   ├── ProfilePage.jsx               # Personal identity form, KYC consent, and enrolled policy editor
│   │   │   ├── DocumentsListPage.jsx         # Dual-tab view: Master Documents vs Policy Offers
│   │   │   ├── UploadDocumentPage.jsx        # Multi-file queue & spreadsheet batch upload dropzone
│   │   │   ├── DocumentDetailsModal.jsx      # Inspect raw text chunks and vector metadata
│   │   │   ├── PeoplePage.jsx                # User management table for admins to review accounts
│   │   │   ├── DashboardPage.jsx             # System analytics overview
│   │   │   └── AuthPage.jsx                  # Clean Signup & Login interface with role selection
│   │   ├── context/
│   │   │   └── AuthContext.jsx               # Global authentication state, tokens, and active profile
│   │   ├── utils/
│   │   │   └── favorites.js                  # Bookmark management for insurance plans
│   │   ├── App.jsx                           # Application routing & active view management
│   │   ├── index.css                         # Tailwind CSS styling and theme definitions
│   │   └── main.jsx                          # Root DOM entry point
│   ├── vite.config.js                        # Vite config with API proxy (/api -> http://localhost:5000)
│   └── package.json                          # Frontend dependencies
│
├── docs/                                     # Architecture & Technical Documentation
│   ├── RAG_Architecture_and_Pipeline_Documentation.pdf # Comprehensive PDF specification
│   ├── RAG_ARCHITECTURE_AND_PIPELINE.md      # Full Markdown architecture specification
│   └── excel_batch_ingestion_and_policy_offers_architecture.md # Excel batch ingestion spec
├── insurance_ai_agent_architecture_orchestration.md # Full system orchestration guide
└── README.md                                 # Primary repository README
```

---

## 6. Quickstart & Local Setup Guide

### Prerequisites
- **Node.js**: `v22.0.0` or higher
- **MongoDB**: Running locally on `mongodb://127.0.0.1:27017`
- **Qdrant Vector Database**: Running on `http://localhost:6333` (via Docker )
- **Groq API Key**: Free API key from [Groq Console](https://console.groq.com)

---

### Step 1: Start Qdrant Vector Engine
```powershell
docker run -d --name qdrant_insurance -p 6333:6333 -p 6334:6334 qdrant/qdrant:latest
```

---

### Step 2: Configure Environment Variables
Inside `Backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/insurance_ai_agent
NODE_ENV=development
CORS_ORIGIN=*
JWT_SECRET=insurance_ai_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d

# Qdrant Vector Engine
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=insurance_policy_rules

# Groq LLM Inference
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

# Local Embeddings Engine
EMBEDDING_PROVIDER=all-minilm
```

---

### Step 3: Start Backend API Server (`Port 5000`)
```powershell
cd Backend
npm install
npm run dev
```
*Health Check: `http://localhost:5000/api/health`*

---

### Step 4: Start Frontend Client (`Port 8080`)
```powershell
cd ../Frontend
npm install
npm run dev
```
Open **`http://localhost:8080`** in your browser.

---

## 7. REST API Endpoints Summary

### Authentication & User Profiles (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Public | Register new account. Returns user info. |
| `POST` | `/api/auth/login` | Public | Authenticate user. Issues JWT Bearer token. |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current authenticated user profile. |
| `PUT` | `/api/auth/profile` | Authenticated | Update user identity, contact details, and KYC consent. |
| `GET` | `/api/auth/users` | Authenticated | List all registered users (supports role/search query). |
| `GET` | `/api/auth/users/:id` | Authenticated | Inspect specific user account details. |
| `PUT` | `/api/auth/users/:id` | `COMPANY_ADMIN` | Update user details, role, or policy numbers. |
| `DELETE`| `/api/auth/users/:id` | `COMPANY_ADMIN` | Delete user account. |

### Enrolled Policies (`/api/policies`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/policies` | Authenticated | List all policies belonging to authenticated user. |
| `POST` | `/api/policies` | Authenticated | Attach a new policy to user account. |
| `GET` | `/api/policies/:id` | Authenticated | Retrieve single policy details. |
| `PUT` | `/api/policies/:id` | Authenticated | Update enrolled policy details (who, age, conditions). |
| `DELETE`| `/api/policies/:id` | Authenticated | Remove policy association. |

### Conversational AI Advisor (`/api/agent`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/agent/query` | Authenticated | Primary RAG advisor chat. Understands intent via NLP, maintains sliding history, syncs MongoDB Ground Truth, and returns 6 filtered recommendations when ready. |
| `GET` | `/api/agent/search` | Authenticated | Semantic & hybrid search across indexed policy clauses and catalog offers. |

### Master Policy Documents (`/api/documents` & `/api/policy-documents`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/documents/upload` | `COMPANY_ADMIN` | Upload PDF, Word, or Excel workbook into Qdrant & MongoDB. |
| `GET` | `/api/documents` | Authenticated | List master policy documents with clause and token stats. |
| `GET` | `/api/documents/:id` | Authenticated | Get master document details and gatekeeper metadata. |
| `GET` | `/api/documents/:id/chunks` | Authenticated | Retrieve semantic chunks from Qdrant vector store. |
| `DELETE`| `/api/documents/:id` | `COMPANY_ADMIN` | Delete master document, disaggregated offers, and vectors. |

### Granular Policy Offers Catalog (`/api/offers` & `/api/policy-offers`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/offers` | Authenticated | List individual policy offers with filters (category, insurer, search). |
| `GET` | `/api/offers/:id` | Authenticated | Get single policy offer details. |
| `PUT` | `/api/offers/:id` | `COMPANY_ADMIN`, `UNDERWRITER` | Update policy terms (excess, premium) and re-sync Qdrant vector point in real time. |
| `DELETE`| `/api/offers/:id` | `COMPANY_ADMIN`, `UNDERWRITER` | Delete single policy offer and remove its point from Qdrant. |

---

## 8. License
Distributed under the MIT License. Built for enterprise insurance compliance, autonomous claims intelligence, and intelligent conversational advisory.
