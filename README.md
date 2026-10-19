# Insurance AI Agent — Autonomous Policy Knowledge, FNOL Claims & Hybrid RAG Platform

**Insurance AI Agent** is a production-grade, enterprise-scale AI intelligence platform engineered specifically for **Insurance Policy Wordings, Multi-Product Rate Catalogues, First Notice of Loss (FNOL) Claims Adjudication, and Statutory Insurance Governance** (covering **Health**, **Motor & Auto**, **Home & Property**, **Life & Annuity**, **Commercial & Liability**, and **Accident / Agriculture**).

The platform features an end-to-end **Zero-Hallucination RAG Pipeline**:
1. **5-Stage Pre-RAG Filtration**: SHA-256 deduplication, multi-format extraction (PDF, Word, Excel, CSV), 4-point stratified sampling, insurance domain density evaluation, and LLM authenticity verification.
2. **Two-Tier Spreadsheet Ingestion**: Automatically disaggregates multi-offer workbooks (e.g., `30_fictional_insurance_offers.xlsx`) into independent policy entities with auto-generated enterprise reference codes.
3. **100% Local ONNX Embeddings**: Runs `all-MiniLM-L6-v2` locally on CPU ($0 external embedding cost, strict data privacy).
4. **Hybrid Qdrant Retrieval**: Vector cosine similarity combined with an 8-signal domain re-ranking algorithm (+15.0 exact clause match boost).
5. **Sub-15ms Semantic Prompt Caching**: Dedupes recurring user questions in Qdrant with zero token cost.
6. **Live Single-Policy Editing**: Allows updating policy terms (deductibles, premiums, limits) and re-syncing vector embeddings in real time without touching other policies.

---

## 📑 Technical Architecture & Documentation PDF

A complete 6-page technical report and architectural specification has been generated and included directly in this repository:
- 📕 **Official PDF Specification:** [`RAG_Architecture_and_Pipeline_Documentation.pdf`](./RAG_Architecture_and_Pipeline_Documentation.pdf)
- 📄 **Markdown Architecture Guide:** [`docs/RAG_ARCHITECTURE_AND_PIPELINE.md`](./docs/RAG_ARCHITECTURE_AND_PIPELINE.md)
- 📊 **Excel Batch Ingestion Spec:** [`excel_batch_ingestion_and_policy_offers_architecture.md`](./docs/excel_batch_ingestion_and_policy_offers_architecture.md)

---

## 1. Technology Stack & Architecture Matrix

| Layer | Technology | Implementation Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + Vite 5 | Pure JavaScript (`.jsx`), runs on `http://localhost:8080` with API proxy to `:5000` |
| **UI Design System** | Tailwind CSS v3.4 | Enterprise Navy & Sky Blue theme (`#0f172a` Navy, `#0284c7` Sky, `#10b981` Emerald, `#a855f7` Purple) |
| **HTTP Client** | Axios v1.7 | Integrated with global auth interceptors and automatic Bearer token injection |
| **Backend Framework** | Node.js (v22+) + Express 5 | ES Modules (`"type": "module"`), REST API on `http://localhost:5000/api` |
| **Primary Database** | MongoDB + Mongoose v9.9 | Stores Users, Master `PolicyDocument` records, granular `PolicyOffer` catalogue, and Prompt Caches |
| **Vector Database** | Qdrant (`localhost:6333`) | Collections: `policy_documents` (384-dim Cosine distance) & `semantic_cache` (prompt cache) |
| **Local Embedding Engine** | `Xenova/all-MiniLM-L6-v2` | 100% local CPU inference via `@huggingface/transformers` ONNX Runtime (`384-dim`, **$0 token cost**) |
| **Large Language Model** | Groq LPU Inference | `llama-3.3-70b-versatile` / `llama-3.1-8b-instant` with static prefix instructions and strict grounding |
| **AI Gatekeeper** | 4-Point Stratified Sampler | Inspects offsets (`0%`, `33%`, `66%`, `90%`) with Domain Density Override for synthetic test benchmarks |
| **Tabular Disaggregation** | SheetJS (`xlsx`) + Parser | Ingests `.xlsx`, `.xls`, `.csv`, auto-extracts individual policies, and assigns standard codes |
| **Token Cost Governance** | Real-Time Cost Calculator | Audits prompt/completion token usage and calculates dollar cost per query |

---

## 2. End-to-End System Pipeline

```
USER CLIENT (BROWSER - Port 8080)
(React 18 + Vite + Tailwind CSS + Axios — Auth UI, Policy Vault, Granular Offers Catalog, Chunks Inspector)
 │
 ▼
EXPRESS 5 REST API BACKEND (Port 5000)
 │
 ├───────────────────────────────┬───────────────────────────────┬───────────────────────────────┐
 ▼                               ▼                               ▼                               ▼
PRE-RAG FILTRATION & INGESTION   TABULAR DISAGGREGATION ENGINE   HYBRID RAG COPILOT              GRANULAR POLICY MUTATION
1. Cryptographic SHA-256 Hash    1. SheetJS Workbook Parser      1. Conversational Context Rewriter1. PUT /api/policy-offers/:id
2. Multi-Format Text Extraction  2. Auto-Detects 30+ Offers      2. Sub-15ms Semantic Cache Check2. MongoDB Document Update
   (PDF, DOCX, XLSX, XLS, CSV)   3. Policy Code Standardizer     3. Local MiniLM Vector Search   3. Selective ONNX Embedding
3. 4-Point Stratified Sampling      (e.g., POL-HLTH-001)         4. 8-Signal Re-Ranking Algorithm4. Targeted Qdrant Point Sync
   (0%, 33%, 66%, 90% offsets)   4. Saves Granular PolicyOffer      (+15.0 Clause, +6.0 Exclusion)  (Zero side effects on
4. Domain Density Analyzer          records in MongoDB           5. Groq Llama-3 Grounded Prompt    remaining 29 offers)
5. AI Gatekeeper LLM Validation  5. Indexes Dedicated Qdrant     6. Verbatim Deductibles & FNOL
   (Overrules test disclaimer)      Vector Point per Offer          Source Citations & Cost Audit
```

---

## 3. Core Capabilities & Specialized Subsystems

### 3.1 Pre-RAG Filtration: The 5 Ingestion Guardrails
To prevent non-insurance documents or duplicate files from corrupting vector retrieval, every uploaded file passes through 5 filters:
1. **Cryptographic SHA-256 Deduplication:** Computes file hash before writing to disk. Duplicate indexed files are blocked immediately.
2. **Multi-Format Extraction:** Seamlessly handles `.pdf` (`pdf-parse`), `.docx`/`.doc` (`mammoth`), `.xlsx`/`.xls`/`.csv` (`xlsx`), and `.txt`.
3. **4-Point Stratified Sampling:** Samples four strategic offsets (Preamble, Perils, Deductibles/Exclusions, FNOL Rules) to evaluate multi-hundred-page policies in ~1,200 tokens.
4. **Domain Density Analyzer:** Counts 12 core insurance indicators (`annual cover limit`, `pre-existing condition`, `waiting period`, `excess / deductible`, `inpatient`, `outpatient`, `claims process`, `underwriting`, `premium`, `endorsement`, `first notice of loss`, `sum insured`). If a document contains authentic policy terms but has a disclaimer (e.g., *"fictional test data"*), it automatically overrides false rejections.
5. **AI Gatekeeper Validation:** Groq Llama-3 verifies document authenticity, returning confidence scores and classification types.

### 3.2 Two-Tier Tabular Disaggregation Engine
When an Excel file containing multiple insurance offers (such as `30_fictional_insurance_offers.xlsx`) is uploaded:
- **Master Record:** Creates parent `PolicyDocument` with `isBatchCatalogue = true`.
- **Granular Records:** Extracts every table row into an independent `PolicyOffer` record in MongoDB.
- **Auto-Generated Policy Codes:** If the table lacks a code, the backend auto-generates standard codes:
  - Health: `POL-HLTH-001`
  - Motor: `POL-MOT-002`
  - Property: `POL-HOM-003`
  - Accident: `POL-ACC-004`
- **Dedicated Vector Points:** Each offer receives its own point in Qdrant with full metadata payloads.

### 3.3 8-Signal Hybrid Re-Ranking Algorithm
Retrieved vectors from Qdrant are re-ranked using domain-specific mathematical scoring adjustments:
- **Exact Policy / Clause Code Match:** `+15.0`
- **Numerical Substring Code Match:** `+10.0`
- **Section Title Match:** `+6.0`
- **Exclusion Clause Query Prioritization:** `+6.0`
- **Excess / Deductible Query Prioritization:** `+5.5`
- **FNOL & Claims Process Prioritization:** `+4.5`
- **Policy Category Alignment:** `+2.5`
- **Domain Discriminator Keywords:** `+2.0 each`
- **Table of Contents Demotion:** `-2.5`

### 3.4 Multi-File Queue Upload & Catalog Inspector UI
- **Multi-File Queue:** The upload dropzone allows selecting or dragging multiple files simultaneously, with an **"Add More Files"** button and individual file removal.
- **Spreadsheet Batch Mode:** Automatically detects Excel spreadsheets and flags them as *Multi-Category Catalogues*.
- **Granular Policy Catalog:** The Documents page includes a tab switcher between **Source Documents** and the **Granular Policy Offers Catalog**, featuring search, filtering, and inline **Edit Policy** modals.

---

## 4. Role-Based Access Control (RBAC) System

The platform supports 3 primary enterprise roles:

| Role | Target Persona | Domain Specific Fields | Permissions & Access |
| :--- | :--- | :--- | :--- |
| **`COMPANY_ADMIN`** | Insurance Firm Executive / IT Admin | `employeeId`, `department` *(Executive Administration)* | Full access: User CRUD, Policy Ingestion, Batch Disaggregation, Granular Policy Editing, Vector Deletion. |
| **`UNDERWRITER`** / **`EMPLOYEE`** | Claims Adjuster / Underwriter | `employeeId`, `department` *(Claims & Underwriting)* | Access to Copilot, Policy Offers Catalog, inline policy editing, claim investigations. |
| **`POLICYHOLDER`** | Customer / Client | `customerId`, `policyNumber`, `policyNumbers[]` | Policy coverage checks, excess/deductible inquiries, FNOL claim submissions. |

---

## 5. Repository Structure

```
Insurance-AI-Agent/
├── Backend/                                  # Node.js 22+ & Express 5 (ES Modules)
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js                        # Environment loader with Zod validation
│   │   │   └── db.js                         # Mongoose connection to MongoDB
│   │   ├── controllers/
│   │   │   ├── auth.controller.js            # User CRUD & Login dispatcher
│   │   │   ├── policyDocument.controller.js  # Upload, Gatekeeper polling & document vault
│   │   │   ├── policyOffer.controller.js     # Granular policy offer CRUD & vector sync
│   │   │   └── ragAgent.controller.js        # RAG Copilot chat & semantic search
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js            # authenticate, optionalAuthenticate, authorizeRoles
│   │   │   ├── error.middleware.js           # Centralized API error handler
│   │   │   └── upload.middleware.js          # Multer memory/disk storage (PDF, DOCX, XLSX, CSV)
│   │   ├── models/
│   │   │   ├── user.model.js                 # Admin, Employee & Policyholder accounts
│   │   │   ├── policyDocument.model.js       # Master ingested policy documents & catalogues
│   │   │   └── policyOffer.model.js          # Individual disaggregated policy offers & plans
│   │   ├── routes/
│   │   │   ├── auth.routes.js                # /api/auth
│   │   │   ├── policyDocument.routes.js      # /api/policy-documents & /api/documents
│   │   │   ├── policyOffer.routes.js         # /api/policy-offers
│   │   │   └── ragAgent.routes.js            # /api/agent & /api/rag
│   │   ├── services/
│   │   │   ├── auth.service.js               # User business logic & Bcrypt verification
│   │   │   ├── aiGatekeeper.service.js       # 4-point stratified sampling & domain density analyzer
│   │   │   ├── aiProvider.service.js         # Local Xenova MiniLM embeddings & Groq client
│   │   │   ├── fileParser.service.js         # PDF, Word, and Excel row flattening
│   │   │   ├── insuranceParser.service.js    # Semantic clause chunker with pre-header injection
│   │   │   ├── policyOffer.service.js        # Workbook disaggregation & single-policy vector sync
│   │   │   ├── policyDocument.service.js     # Master document ingestion orchestration
│   │   │   ├── qdrant.service.js             # Qdrant REST client & collection management
│   │   │   ├── vectorStore.service.js        # Document indexing & 8-signal hybrid re-ranking
│   │   │   └── ragAgent.service.js           # Conversational contextualization & grounded answer generation
│   │   ├── utils/
│   │   │   ├── apiError.js                   # Standardized error exceptions
│   │   │   ├── apiResponse.js                # Standardized JSON responses
│   │   │   ├── asyncHandler.js               # Automatic async try/catch wrapper
│   │   │   └── jwt.js                        # JWT signing and verification
│   │   ├── app.js                            # Express app bootstrap & route registration
│   │   └── server.js                         # Port 5000 bootstrap & vector collection init
│   ├── .env
│   ├── package.json
│
├── Frontend/                                 # React 18 + Vite 5 + Tailwind CSS + Axios
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js                     # Axios instance with auth interceptor
│   │   │   ├── auth.api.js                   # Authentication & user management calls
│   │   │   └── documents.api.js              # Documents, Policy Offers, and RAG Copilot calls
│   │   ├── components/
│   │   │   ├── Navbar.jsx                    # Navigation bar with role-based links
│   │   │   ├── AiGatekeeperModal.jsx         # Real-time upload progress & gatekeeper feedback
│   │   │   ├── PolicyOffersCatalog.jsx       # Granular policy offers data table & filters
│   │   │   └── EditPolicyOfferModal.jsx      # Modal for editing policy terms & vector re-sync
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx                  # Clean Signup & Login interface
│   │   │   ├── HomePage.jsx                  # Platform dashboard & quick actions
│   │   │   ├── UploadDocumentPage.jsx        # Multi-file queue & spreadsheet batch upload
│   │   │   ├── DocumentsListPage.jsx         # Dual-tab view: Master Documents vs Policy Offers
│   │   │   ├── DocumentDetailsModal.jsx      # Policy details & Semantic Chunks Inspector
│   │   │   └── PeoplePage.jsx                # Role-based user administration
│   │   ├── App.jsx                           # Application routing & layout
│   │   └── main.jsx                          # Root DOM entry point
│   ├── vite.config.js                        # Proxy configuration (/api -> http://localhost:5000)
│   └── package.json
│
├── docs/                                     # Architecture & Technical Documentation
│   ├── RAG_Architecture_and_Pipeline_Documentation.pdf # 6-page comprehensive PDF
│   ├── RAG_ARCHITECTURE_AND_PIPELINE.md      # Full Markdown architecture specification
│   └── excel_batch_ingestion_and_policy_offers_architecture.md # Excel batch ingestion spec
├── scripts/
│   └── generate_rag_pdf.py                   # ReportLab script for generating PDF documentation
└── README.md
```

---

## 6. Quickstart & Local Setup Guide

### Prerequisites
- **Node.js**: `v22.0.0` or higher
- **MongoDB**: Running locally on `mongodb://127.0.0.1:27017`
- **Qdrant Vector Database**: Running on `http://localhost:6333` (via Docker)
- **Python 3.10+** (optional, for compiling documentation PDFs)

### Step 1: Start Qdrant Vector Database
```powershell
docker run -d --name qdrant_insurance -p 6333:6333 -p 6334:6334 qdrant/qdrant:latest
```

### Step 2: Start Backend Server (`Port 5000`)
```powershell
cd Backend
npm install
node src/server.js
```
*Health Check: `http://127.0.0.1:5000/api/health`*

### Step 3: Start Frontend Dev Server (`Port 8080`)
```powershell
cd ../Frontend
npm install
npm run dev
```
Open **`http://localhost:8080`** in your browser.

---

## 7. REST API Endpoints Summary

### Authentication & Users
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Public | Register new account. Returns user info (no auto-token). |
| `POST` | `/api/auth/login` | Public | Authenticate user. Issues JWT Bearer token. |
| `GET` | `/api/auth/users` | Authenticated | List all registered users with role and search filters. |
| `GET` | `/api/auth/users/:id` | Authenticated | Get detailed user profile. |
| `PUT` | `/api/auth/users/:id` | `COMPANY_ADMIN` | Update user details, role, or policy numbers. |
| `DELETE`| `/api/auth/users/:id` | `COMPANY_ADMIN` | Remove user account. |

### Master Policy Documents
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/policy-documents` | `COMPANY_ADMIN` | Upload PDF, Word, or Excel workbook into Qdrant & MongoDB. |
| `GET` | `/api/policy-documents` | Authenticated | List master policy documents with clause and token stats. |
| `GET` | `/api/policy-documents/:id` | Authenticated | Get master document details and gatekeeper metadata. |
| `GET` | `/api/policy-documents/:id/chunks` | Authenticated | Retrieve semantic chunks from Qdrant vector store. |
| `GET` | `/api/policy-documents/upload-progress/:uploadId` | Public / Auth | Poll real-time upload, Gatekeeper, and vector indexing progress. |
| `DELETE`| `/api/policy-documents/:id` | `COMPANY_ADMIN` | Delete master document, child policy offers, and Qdrant vectors. |

### Granular Policy Offers Catalogue
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/policy-offers` | Authenticated | List individual policy offers with filters (category, insurer, search). |
| `GET` | `/api/policy-offers/:id` | Authenticated | Get single policy offer details. |
| `PUT` | `/api/policy-offers/:id` | `COMPANY_ADMIN`, `UNDERWRITER` | Update policy terms (excess, premium) and re-sync Qdrant vector in real time. |
| `DELETE`| `/api/policy-offers/:id` | `COMPANY_ADMIN`, `UNDERWRITER` | Delete single policy offer and remove its point from Qdrant. |

### RAG Copilot & Semantic Retrieval
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/agent/query` | Authenticated | Ask policy question. Contextualizes follow-ups, retrieves clauses, and returns grounded answer. |
| `GET` | `/api/agent/search` | Authenticated | Semantic & hybrid search across policy clauses and offers. |

---

## 8. License
Distributed under the MIT License. Built for enterprise insurance compliance and autonomous claims intelligence.
