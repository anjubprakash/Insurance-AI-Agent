import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

# Palette constants matching modern enterprise design
DARK_EMERALD = colors.HexColor('#0d3b2e')
PRIMARY_EMERALD = colors.HexColor('#059669')
ACCENT_GREEN = colors.HexColor('#10b981')
TEXT_DARK = colors.HexColor('#0f172a')
TEXT_MUTED = colors.HexColor('#475569')
TABLE_HEADER_BG = colors.HexColor('#0f2922')
TABLE_ALT_ROW = colors.HexColor('#f8fafc')

class CleanNumberedCanvas(canvas.Canvas):
    """
    Canvas with all running headers, footers, and decorative boxes completely removed.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        # All running headers, footers, lines, and page numbers removed as requested
        pass


def build_pdf(filename="Insurance_AI_Agent_Architecture_Specification.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom Typography Styles (clean headings and text, no border boxes)
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=34,
        leading=42,
        textColor=DARK_EMERALD,
        alignment=1, # Center
        spaceAfter=0
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11.5,
        leading=17,
        textColor=TEXT_MUTED,
        alignment=1, # Center
        spaceAfter=18
    )

    card_label_style = ParagraphStyle(
        'CardLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=PRIMARY_EMERALD,
        alignment=0,
        spaceAfter=4
    )

    card_val_style = ParagraphStyle(
        'CardVal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=14,
        textColor=TEXT_DARK,
        alignment=0
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=DARK_EMERALD,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=PRIMARY_EMERALD,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=TEXT_DARK,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=4
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor('#0f172a')
    )

    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=TEXT_DARK
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11.5,
        textColor=colors.white
    )

    story = []

    # =========================================================================
    # PAGE 1: COVER PAGE (TITLE ONLY)
    # =========================================================================
    story.append(Spacer(1, 330))
    story.append(Paragraph("Insurance AI Agent", title_style))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: PROJECT BACKGROUND, SPECIFICATIONS & BENCHMARKS
    # =========================================================================
    story.append(Paragraph("1. Project Background: Current vs. Proposed System", h1_style))

    story.append(Paragraph("1.1 The Current System (Traditional Limitations)", h2_style))
    story.append(Paragraph(
        "Traditional insurance portals and customer support workflows face significant structural hurdles: "
        "policy wordings, endorsement schedules, and waiting periods are locked within multi-page PDF documents or "
        "dense spreadsheet rate cards. Extracting accurate terms manually requires substantial human effort, while generic "
        "AI models frequently hallucinate terms without verified clause citations. Furthermore, customer intake is typically "
        "gated behind rigid, multi-page forms that lead to high abandonment rates.",
        body_style
    ))

    # Proposed System explanation: focused on Insurance AI Agent capabilities & customer experience
    story.append(Paragraph("1.2 The Proposed System (The Insurance AI Agent Platform)", h2_style))
    story.append(Paragraph(
        "The proposed system establishes an autonomous, 24/7 Insurance AI Agent designed to serve as an intelligent copilot "
        "for policyholders, advisors, and underwriters. Rather than forcing customers to navigate dense policy manuals or "
        "endure frustrating questionnaire forms, the agent conducts natural conversational advisory to discover personal and "
        "commercial coverage needs. It actively analyzes customer context—whether an entrepreneur seeking commercial liability, "
        "a parent safeguarding family health, or a homeowner protecting property—and delivers tailored plan recommendations "
        "with complete clarity on coverage limits, deductibles, waiting periods, and exclusions. Customers can converse freely, "
        "review details of their active enrolled policies, compare plans side-by-side, and bookmark favorite insurance options "
        "for ongoing evaluation—delivering an intuitive, transparent, and trustworthy insurance experience.",
        body_style
    ))

    # Core metadata details added as bullet points after Current & Proposed System
    story.append(Spacer(1, 4))
    story.append(Paragraph("• <b>Insurance Domain Scope:</b> Commercial, Health, Auto, Home, Life, Accident, Agriculture, and Travel.", bullet_style))
    story.append(Paragraph("• <b>Primary LLM Engine:</b> Groq Cloud LPU (OpenAI GPT-OSS 120B / openai/gpt-oss-120b).", bullet_style))
    story.append(Paragraph("• <b>Data & Vector Knowledge Base:</b> MongoDB Database + Qdrant Vector Store.", bullet_style))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Core Architectural Benchmarks", h2_style))

    # Benchmarks Table WITHOUT Specification Value column
    benchmarks_data = [
        [Paragraph("Metric / Benchmark Area", table_header_style), Paragraph("Implementation & Architectural Details", table_header_style)],
        [Paragraph("Vector Retrieval Engine", table_cell_style), Paragraph("Qdrant Vector Store using fast cosine similarity search across 384-dimensional policy embeddings with insurance category filtering.", table_cell_style)],
        [Paragraph("Generative LLM Engine", table_cell_style), Paragraph("Groq Cloud LPU hardware running OpenAI GPT-OSS 120B (openai/gpt-oss-120b) with sub-second generation and strict JSON formatting.", table_cell_style)],
        [Paragraph("Local Embedding Engine", table_cell_style), Paragraph("Xenova/all-MiniLM-L6-v2 executed locally via @huggingface/transformers ONNX CPU runtime with zero external token cost.", table_cell_style)],
        [Paragraph("Two-Layer Data Pipeline", table_cell_style), Paragraph("Direct integration with MongoDB for transactional ground truth and Qdrant for semantic policy clause similarity.", table_cell_style)],
        [Paragraph("Pre-RAG Ingestion Guardrails", table_cell_style), Paragraph("5-stage verification including SHA-256 deduplication, 4-point stratified sampling, and Groq AI Gatekeeper validation.", table_cell_style)],
        [Paragraph("Customer Intake Methodology", table_cell_style), Paragraph("Natural language semantic discovery with dynamic slot extraction and zero rigid numbered checklist forms.", table_cell_style)],
        [Paragraph("Insurance Domain Scope", table_cell_style), Paragraph("Comprehensive multi-line coverage for Commercial, Health, Auto, Home, Life, Accident, Agriculture, and Travel.", table_cell_style)]
    ]
    t_benchmarks = Table(benchmarks_data, colWidths=[150, 365])
    t_benchmarks.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_BG),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_ALT_ROW]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_benchmarks)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: SEPARATE TECH STACK TABLES (WITHOUT VERSIONS)
    # =========================================================================
    story.append(Paragraph("2. Technology Stack Breakdown", h1_style))
    story.append(Paragraph(
        "The system architecture is structured across three clearly defined, easily understandable tiers:",
        body_style
    ))

    # 1. Frontend Tech Stack Table (Component & Technology only)
    story.append(Paragraph("2.1 Frontend Technology Stack", h2_style))
    fe_data = [
        [Paragraph("Component", table_header_style), Paragraph("Technology", table_header_style)],
        [Paragraph("SPA Framework", table_cell_style), Paragraph("React", table_cell_style)],
        [Paragraph("Build Engine", table_cell_style), Paragraph("Vite", table_cell_style)],
        [Paragraph("Design System", table_cell_style), Paragraph("Tailwind CSS", table_cell_style)],
        [Paragraph("Iconography", table_cell_style), Paragraph("Lucide React", table_cell_style)],
        [Paragraph("HTTP Client", table_cell_style), Paragraph("Axios", table_cell_style)],
        [Paragraph("Favorites Sync", table_cell_style), Paragraph("Browser Custom Events", table_cell_style)]
    ]
    t_fe = Table(fe_data, colWidths=[200, 315])
    t_fe.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_BG),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_ALT_ROW]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_fe)

    story.append(Spacer(1, 6))

    # 2. Backend Tech Stack Table (Component & Technology only)
    story.append(Paragraph("2.2 Backend Technology Stack", h2_style))
    be_data = [
        [Paragraph("Component", table_header_style), Paragraph("Technology", table_header_style)],
        [Paragraph("Runtime Server", table_cell_style), Paragraph("Node.js & Express", table_cell_style)],
        [Paragraph("Transactional Database", table_cell_style), Paragraph("MongoDB & Mongoose", table_cell_style)],
        [Paragraph("File Ingestion", table_cell_style), Paragraph("Multer (for PDF, Word DOCX, and text)", table_cell_style)],
        [Paragraph("Workbook Parser", table_cell_style), Paragraph("SheetJS (xlsx)", table_cell_style)],
        [Paragraph("Document Parsers", table_cell_style), Paragraph("pdf-parse & mammoth", table_cell_style)],
        [Paragraph("Security & Auth", table_cell_style), Paragraph("jsonwebtoken & bcryptjs", table_cell_style)]
    ]
    t_be = Table(be_data, colWidths=[200, 315])
    t_be.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_BG),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_ALT_ROW]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_be)

    story.append(Spacer(1, 6))

    # 3. LLM & AI Engine Stack Table (Component & Technology only, Semantic Chunker removed)
    story.append(Paragraph("2.3 LLM & Vector AI Engine Stack", h2_style))
    ai_data = [
        [Paragraph("Component", table_header_style), Paragraph("Technology", table_header_style)],
        [Paragraph("Primary LLM Engine", table_cell_style), Paragraph("Groq SDK (openai/gpt-oss-120b)", table_cell_style)],
        [Paragraph("Vector Database", table_cell_style), Paragraph("Qdrant Vector Store", table_cell_style)],
        [Paragraph("Local Embeddings", table_cell_style), Paragraph("all-MiniLM-L6-v2 (ONNX)", table_cell_style)],
        [Paragraph("Intent Extractor", table_cell_style), Paragraph("AI Gatekeeper Engine", table_cell_style)]
    ]
    t_ai = Table(ai_data, colWidths=[200, 315])
    t_ai.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_BG),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_ALT_ROW]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_ai)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: PRE-RAG INGESTION & TWO-LAYER ARCHITECTURE (CONCISE, DIRECT)
    # =========================================================================
    story.append(Paragraph("3. Pre-RAG Ingestion Pipeline & Quality Guardrails", h1_style))
    story.append(Paragraph(
        "Uploaded documents undergo a streamlined five-stage verification pipeline before vector indexation:",
        body_style
    ))

    # Shortened Pre-RAG Stages (direct content, no heavy background paragraphs)
    story.append(Paragraph(
        "• <b>Stage 1 — Cryptographic Hash:</b> Calculates SHA-256 on the raw file buffer to immediately detect duplicates, preventing redundant embeddings and database clutter.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Stage 2 — Multi-Format Text Extraction:</b> Converts PDF policy manuals, Word DOCX documents, multi-sheet Excel workbooks, and CSVs into standardized clean text streams.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Stage 3 — 4-Point Stratified Sampling:</b> Extracts text samples at 0%, 33%, 66%, and 90% document offsets, enabling fast policy evaluation in under 1,200 tokens.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Stage 4 — Domain Density Evaluation:</b> Scans for 12 statutory insurance terms (deductibles, excess, waiting periods, limits) to confirm document legitimacy and override false rejections.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Stage 5 — AI Gatekeeper Verification:</b> OpenAI GPT validates policy authenticity, confirms the insurance category, and generates a validation confidence score prior to vectorization.",
        bullet_style
    ))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Two-Layer Architecture & Simple Data Flow", h2_style))
    story.append(Paragraph(
        "The system organizes insurance data cleanly across two simple layers to prevent any plan confusion:",
        body_style
    ))
    story.append(Paragraph(
        "• <b>1. Database Storage (MongoDB):</b> Stores customer accounts, enrolled policies, and insurance plans safely and reliably.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>2. Vector Search (Qdrant):</b> Searches policy documents in milliseconds so the AI can find the right terms instantly.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Independent Plan Records:</b> Each insurance plan is stored as its own separate record with its own vector, so policies never get mixed up.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Easy Policy Updates:</b> Updating or deleting one plan updates only that plan, without affecting any other policies in the catalog.",
        bullet_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 5: CONVERSATIONAL AI ADVISOR & INTAKE SPECIFICATION
    # =========================================================================
    story.append(Paragraph("4. Conversational AI Advisor & Dynamic Intake", h1_style))
    story.append(Paragraph(
        "The conversational advisor guides policyholders through discovery, comparison, and enrollment "
        "using dynamic natural language dialog rather than rigid, checklist-style interrogations.",
        body_style
    ))

    story.append(Paragraph("Core Conversational Principles", h2_style))
    story.append(Paragraph(
        "<b>1. Conversational Needs Discovery First:</b> When a user asks an exploratory inquiry (e.g. "
        "<i>'I opened a small bakery with my brother, what insurance do we need?'</i>), the advisor explains relevant coverage types "
        "(Public Liability, Commercial Property, Business Interruption) and asks clarifying questions regarding their activities and budget. "
        "Specific plan recommendation cards are held in reserve until the user's specific context is understood.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>2. Dynamic Semantic Slot Extraction:</b> The advisor extracts profile attributes semantically "
        "(<code>whoIsInsured</code>, <code>insuredName</code>, <code>coveredAge</code>, <code>healthOrRiskConditions</code>, "
        "<code>insuranceType</code>) directly from prose, adapting to the relevant category without rigid numbered forms.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>3. Progressive Ground Truth Engine:</b> As intake details are shared, <code>saveProgressivePolicyToDb</code> records a draft "
        "policy in MongoDB. The persistent ground truth is injected into subsequent prompts, guaranteeing that the AI never re-asks for details "
        "already provided.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>4. Multi-Person Separation:</b> If a policyholder inquires about coverage for multiple family members (e.g. Father and Mother "
        "separately), the advisor maintains isolated records in <code>extractedProfiles</code>, preventing cross-contamination of medical history "
        "and age parameters.",
        bullet_style
    ))
    story.append(Paragraph(
        "<b>5. Enrolled Policy Catch-Up:</b> Users can ask <i>'What does my active policy cover?'</i> or <i>'Explain dad's plan'</i>. The advisor "
        "identifies the policy by its <code>#POL-...</code> number from database ground truth and thoroughly explains its limits, premiums, and benefits.",
        bullet_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 6: FAVORITES, SECURITY & API SPECIFICATION (NO CERTIFICATION LINE)
    # =========================================================================
    story.append(Paragraph("5. Favorites System, Security & REST API", h1_style))
    
    story.append(Paragraph("Cross-Tab Real-Time Favorites Synchronization", h2_style))
    story.append(Paragraph(
        "To allow users to bookmark and evaluate insurance options across both the plan catalog and AI conversations, "
        "a unified Favorites subsystem is integrated across the frontend:",
        body_style
    ))
    story.append(Paragraph(
        "• <b>Heart Toggle Action:</b> Embedded on every plan card in <code>InsurancePage.jsx</code> and every AI recommendation card in <code>AiChatPage.jsx</code>. Turns vibrant red (<code>fill-rose-500</code>) when active.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Global Custom Event Sync:</b> Dispatches <code>insurance_favorites_changed</code> browser events on mutation, ensuring instant updates across all open tabs.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Profile Favorites Hub:</b> Accessible via the <b>Favorites ({count})</b> side tab in <code>ProfilePage.jsx</code>. Displays saved cards with coverage limits, premiums, deductibles, and direct 'Talk to Advisor ⚡' shortcuts.",
        bullet_style
    ))

    story.append(Spacer(1, 6))
    story.append(Paragraph("Role-Based Access Control (RBAC) Matrix", h2_style))

    rbac_data = [
        [Paragraph("Role Name", table_header_style), Paragraph("Authorized Personas", table_header_style), Paragraph("Operational Privileges & Boundaries", table_header_style)],
        [Paragraph("COMPANY_ADMIN", table_cell_style), Paragraph("System Executive & Underwriting Lead", table_cell_style), Paragraph("Full CRUD on users, batch ingestion, granular policy mutations, vector purges.", table_cell_style)],
        [Paragraph("UNDERWRITER / EMPLOYEE", table_cell_style), Paragraph("Claims Adjuster & Underwriter", table_cell_style), Paragraph("Policy catalogue inspection, inline policy edits, customer claim reviews.", table_cell_style)],
        [Paragraph("POLICYHOLDER", table_cell_style), Paragraph("Consumer / Insured Client", table_cell_style), Paragraph("AI Advisory chat, personal policy portfolio, KYC consent, favorites management.", table_cell_style)]
    ]
    t_rbac = Table(rbac_data, colWidths=[120, 165, 230])
    t_rbac.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_BG),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_ALT_ROW]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_rbac)

    story.append(Spacer(1, 6))
    story.append(Paragraph("Key REST API Endpoints", h2_style))

    api_data = [
        [Paragraph("HTTP Method & Route", table_header_style), Paragraph("Primary Controller", table_header_style), Paragraph("Functional Description", table_header_style)],
        [Paragraph("POST /api/agent/query", table_cell_style), Paragraph("ragAgent.controller.js", table_cell_style), Paragraph("Unified advisory endpoint with semantic retrieval & intake persistence.", table_cell_style)],
        [Paragraph("POST /api/policy-documents/upload", table_cell_style), Paragraph("policyDocument.controller.js", table_cell_style), Paragraph("Multi-file upload with AI Gatekeeper validation & disaggregation.", table_cell_style)],
        [Paragraph("PUT /api/policy-offers/:id", table_cell_style), Paragraph("policyOffer.controller.js", table_cell_style), Paragraph("Mutates single policy terms and re-syncs Qdrant vector point.", table_cell_style)],
        [Paragraph("DELETE /api/policy-offers/:id", table_cell_style), Paragraph("policyOffer.controller.js", table_cell_style), Paragraph("Permanently deletes offer from MongoDB and purges vector point in Qdrant.", table_cell_style)],
        [Paragraph("GET /api/policies", table_cell_style), Paragraph("policyDetail.controller.js", table_cell_style), Paragraph("Retrieves all enrolled policies for the authenticated policyholder.", table_cell_style)]
    ]
    t_api = Table(api_data, colWidths=[160, 155, 200])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_BG),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_ALT_ROW]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_api)

    # =========================================================================
    # PAGE 7: END-TO-END SYSTEM DATA FLOW DIAGRAM
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("6. End-to-End System Data Flow Diagram", h1_style))
    story.append(Paragraph(
        "The following architecture diagram details the complete data lifecycle of the Insurance AI Agent platform—illustrating "
        "how documents are ingested, vectorized, stored, and queried through conversational RAG with progressive database synchronization:",
        body_style
    ))
    story.append(Spacer(1, 10))

    # Flow Box 1: Client Ingress
    flow_step1 = [
        [Paragraph("<b>STEP 1: CLIENT INGRESS & USER ACTION</b>", table_header_style)],
        [Paragraph(
            "<b>Users & Portals:</b> Policyholders explore coverage via <code>AiChatPage.jsx</code>; Underwriters upload manuals via <code>UploadDocumentPage.jsx</code>.<br/>"
            "<b>API Gateway:</b> Secure REST endpoints (<code>Express 5 + JWT Auth</code>) route requests to dedicated ingestion or query pipelines.",
            table_cell_style
        )]
    ]
    t_flow1 = Table(flow_step1, colWidths=[515])
    t_flow1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f2922')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_flow1)

    story.append(Spacer(1, 6))
    story.append(Paragraph("<font color='#059669'><b>↓ &nbsp; &nbsp; DUAL PROCESSING PATHWAYS (INGESTION vs. CONVERSATIONAL RAG) &nbsp; &nbsp; ↓</b></font>", ParagraphStyle('ArrowStyle1', parent=styles['Normal'], alignment=1, fontSize=9, fontName='Helvetica-Bold')))
    story.append(Spacer(1, 6))

    # Flow Box 2: Dual Pathways Side-by-Side
    flow_step2 = [
        [
            Paragraph("<b>PATH A: DOCUMENT INGESTION PIPELINE</b>", table_header_style),
            Paragraph("<b>PATH B: CONVERSATIONAL RAG QUERY PIPELINE</b>", table_header_style)
        ],
        [
            Paragraph(
                "<b>1. File Streaming:</b> Multer streams PDF, DOCX, XLSX, and CSV documents.<br/>"
                "<b>2. Text Extraction:</b> <code>pdf-parse</code> and <code>mammoth</code> extract verbatim clause streams.<br/>"
                "<b>3. Semantic Chunking:</b> Partitions text into clauses with codes and pre-headers.<br/>"
                "<b>4. Local ONNX Embedder:</b> <code>all-MiniLM-L6-v2</code> generates 384-dimensional dense vectors locally ($0 API cost).<br/>"
                "<b>5. Vector Upsert:</b> Stores points directly into Qdrant collection <code>insurance_policy_rules</code>.",
                table_cell_style
            ),
            Paragraph(
                "<b>1. User Inquiry:</b> Customer sends question via <code>AiChatPage.jsx</code>.<br/>"
                "<b>2. Sliding Window:</b> Last 16 messages (8 turns) formatted with 400-char caps.<br/>"
                "<b>3. Semantic Retrieval:</b> Question is embedded and searched against Qdrant using cosine similarity in &lt;15ms.<br/>"
                "<b>4. Ground Truth Ingestion:</b> Active policy details fetched from MongoDB to eliminate memory loss.<br/>"
                "<b>5. Unified LLM Call:</b> Groq Cloud LPU (<code>openai/gpt-oss-120b</code>) generates verified JSON answers.",
                table_cell_style
            )
        ]
    ]
    t_flow2 = Table(flow_step2, colWidths=[255, 260])
    t_flow2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f2922')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_flow2)

    story.append(Spacer(1, 6))
    story.append(Paragraph("<font color='#059669'><b>↓ &nbsp; &nbsp; STORAGE CONVERGENCE & AUTO-INTAKE SYNCHRONIZATION &nbsp; &nbsp; ↓</b></font>", ParagraphStyle('ArrowStyle2', parent=styles['Normal'], alignment=1, fontSize=9, fontName='Helvetica-Bold')))
    story.append(Spacer(1, 6))

    # Flow Box 3: Persistent Storage & UI Feedback
    flow_step3 = [
        [Paragraph("<b>STEP 3: PERSISTENT STORAGE & REAL-TIME CLIENT FEEDBACK</b>", table_header_style)],
        [Paragraph(
            "<b>Qdrant Vector Database:</b> Maintains 384-dim policy vectors with category payloads for sub-second similarity retrieval.<br/>"
            "<b>MongoDB Transactional Store:</b> Reliably saves user profiles, uploaded document metadata, and policy catalogs.<br/>"
            "<b>Progressive Auto-Intake Persistence:</b> <code>savePolicyIntake</code> writes draft policyholder details to MongoDB in real time.<br/>"
            "<b>Instant Live Client Sync:</b> UI updates dynamically with tailored plan cards, intake progress bars, and instant resumption.",
            table_cell_style
        )]
    ]
    t_flow3 = Table(flow_step3, colWidths=[515])
    t_flow3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f2922')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_flow3)

    # Build the document
    doc.build(story, canvasmaker=CleanNumberedCanvas)
    print(f"[SUCCESS] Generated Architecture Specification PDF: {filename}")

if __name__ == "__main__":
    out_pdf = "Insurance_AI_Agent_Architecture_Specification.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    build_pdf(out_pdf)
