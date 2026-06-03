# AI Project Engineer — Technical Design Document

**Version:** 0.1 (MVP)  
**Author:** Founding Engineering  
**Last Updated:** 2026-05-31

---

## 1. Executive Summary

AI Project Engineer is an AI-native construction collaboration platform that helps project teams review specifications, drawings, and submittals faster. The MVP focuses on three core workflows:

1. **Document ingestion** — Upload construction PDFs, extract structured content, and index for semantic search.
2. **Project Chat** — Ask natural-language questions about project documents with cited answers.
3. **AI Agents** — Detect potential RFIs from document contradictions and review submittals against specs.

The system is designed as a **multi-tenant, organization-scoped** SaaS product with clear separation between the user-facing app (Next.js), async orchestration (Trigger.dev), and compute-heavy document processing (FastAPI).

---

## 2. System Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                               │
│                    Next.js 15 App Router + React Server Components          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APPLICATION (Vercel)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │ Auth UI     │  │ Projects UI  │  │ Chat UI     │  │ Agent Triggers   │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  └────────┬─────────┘  │
│         │                │                 │                   │            │
│  ┌──────┴────────────────┴─────────────────┴───────────────────┴─────────┐  │
│  │                    Route Handlers / Server Actions                     │  │
│  │   /api/projects  /api/documents  /api/chat  /api/agents/*            │  │
│  └──────┬──────────────────┬────────────────────┬───────────────────────┘  │
└─────────┼──────────────────┼────────────────────┼──────────────────────────┘
          │                  │                    │
          ▼                  ▼                    ▼
┌─────────────────┐  ┌───────────────┐  ┌───────────────────────────────────┐
│    SUPABASE     │  │  TRIGGER.DEV  │  │         FASTAPI PROCESSOR         │
│                 │  │               │  │                                   │
│ • Auth (JWT)    │  │ • doc.process │  │ • pdfplumber (text extraction)    │
│ • Postgres      │◄─┤ • rfi.scan    ├─►│ • pymupdf (page images)           │
│ • pgvector      │  │ • submittal   │  │ • section/page chunking           │
│ • Storage       │  │   .review     │  │ • embedding generation            │
│ • RLS           │  │ • webhooks    │  │ • OCR fallback (future)           │
└─────────────────┘  └───────┬───────┘  └───────────────┬───────────────────┘
                             │                          │
                             ▼                          ▼
                     ┌───────────────────────────────────────┐
                     │         LLM PROVIDERS                 │
                     │  OpenAI (embeddings, chat, agents)    │
                     │  Anthropic Claude (agent reasoning)   │
                     └───────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility | Runtime |
|-----------|----------------|---------|
| **Next.js App** | Auth flows, CRUD UI, chat streaming, signed upload URLs, API gateway to Supabase & agents | Vercel / Node |
| **Supabase Auth** | Email/password + magic link; JWT with `sub` (user id) | Managed |
| **Supabase Postgres** | Source of truth for all domain data; pgvector for semantic retrieval | Managed |
| **Supabase Storage** | Raw PDFs, extracted page images, submittal files | Managed |
| **Trigger.dev** | Durable background jobs, retries, observability, webhook callbacks | Cloud |
| **FastAPI Processor** | CPU/GPU-heavy PDF parsing, image extraction, chunking, embedding batch writes | Fly.io / Railway / ECS |
| **OpenAI API** | `text-embedding-3-small` for vectors; `gpt-4o` for chat & structured agent output | External |
| **Claude API** | Long-context reasoning for RFI/submittal agents (optional primary) | External |

### 2.3 Core Data Flows

#### 2.3.1 Document Upload & Processing

```
User selects PDF
    → Next.js requests signed upload URL (Storage)
    → Client uploads directly to Supabase Storage
    → Next.js creates `documents` row (status: pending)
    → Next.js triggers Trigger.dev job: `document.process`
        → Job downloads PDF from Storage
        → Job calls FastAPI POST /process/document
            → Extract text per page (pdfplumber)
            → Render page images (pymupdf)
            → Detect sheet number + title (heuristics + LLM assist)
            → Chunk by section/page boundaries
            → Generate embeddings (OpenAI)
            → Return structured payload
        → Job writes document_pages, chunks (with vectors), updates document status
        → Job uploads page images to Storage
    → UI polls document status → ready
```

#### 2.3.2 Project Chat (RAG)

```
User asks question in project context
    → POST /api/projects/:id/chat
    → Embed query (OpenAI)
    → pgvector similarity search scoped to project_id
    → Re-rank top-k chunks (optional cross-encoder later)
    → LLM prompt with chunk context + citation instructions
    → Stream response with chunk references (page, sheet, excerpt)
    → Persist chat message + citations (future: chat_messages table)
```

#### 2.3.3 RFI Agent — "Find Potential RFIs"

```
User clicks "Find Potential RFIs"
    → POST /api/projects/:id/agents/rfi-scan
    → Create agent_runs row (status: running)
    → Trigger.dev job: `agent.rfi-scan`
        → Retrieve high-value chunks (specs, drawings, schedules)
        → LLM multi-pass: identify contradictions, missing info, code conflicts
        → For each finding: create `issues` row with structured JSON
        → Update agent_runs with summary + counts
    → UI displays issues list with evidence + draft RFI text
```

#### 2.3.4 Submittal Review Agent

```
User uploads submittal PDF
    → Same ingestion pipeline (documents + chunks)
    → POST /api/projects/:id/submittals/:id/review
    → Trigger.dev job: `agent.submittal-review`
        → Retrieve relevant spec chunks (vector search on submittal summary)
        → LLM comparison: submittal vs spec requirements
        → Output: pass | warning | fail + findings
        → Update submittals row + agent_runs
    → UI shows review result with cited non-compliance items
```

### 2.4 Security & Multi-Tenancy

- **Tenant boundary:** `organization_id` on all domain tables.
- **Project scope:** All project artifacts scoped via `project_id` → `organization_id`.
- **Auth:** Supabase JWT validated on every Next.js API route and FastAPI request (service role for background jobs only).
- **RLS:** Postgres Row Level Security enforced for all client-direct Supabase queries.
- **Storage:** Bucket policies restrict reads/writes to org members; paths include `{org_id}/{project_id}/`.
- **Service keys:** FastAPI and Trigger.dev use Supabase service role; never exposed to browser.

### 2.5 Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector store | pgvector in Supabase | Single DB, transactional consistency, simpler ops |
| Embedding model | OpenAI text-embedding-3-small (1536 dims) | Cost/quality balance; easy swap |
| Job orchestration | Trigger.dev v3 | Native TypeScript, retries, dev UX |
| PDF processing | FastAPI (Python) | Best ecosystem for pdfplumber/pymupdf |
| Chat streaming | Vercel AI SDK | First-class Next.js integration |
| Monorepo | Turborepo | Shared types between web + jobs |

### 2.6 Non-Goals (MVP)

- Real-time collaborative editing
- Mobile native apps
- BIM/IFC integration
- Automated drawing takeoff
- Email ingestion of RFIs
- Custom model fine-tuning

---

## 3. Database Schema

### 3.1 Entity Relationship Overview

```
organizations ──┬── organization_members ── profiles (users)
                │
                └── projects ──┬── documents ──┬── document_pages
                               │               └── chunks (vector)
                               ├── issues
                               ├── rfis
                               ├── submittals
                               └── agent_runs
```

### 3.2 Table Definitions

#### `profiles`
Extends Supabase `auth.users`. One row per authenticated user.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | FK → auth.users(id) ON DELETE CASCADE |
| email | text | Denormalized from auth |
| full_name | text | |
| avatar_url | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `organizations`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| slug | text UNIQUE | URL-safe identifier |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `organization_members`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK | → organizations |
| user_id | uuid FK | → profiles |
| role | enum | owner, admin, member, viewer |
| created_at | timestamptz | |
| UNIQUE(organization_id, user_id) | | |

#### `projects`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK | → organizations |
| name | text NOT NULL | |
| project_number | text | e.g. "2024-001" |
| address | text | |
| status | enum | active, archived |
| created_by | uuid FK | → profiles |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `documents`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK | → projects |
| organization_id | uuid FK | Denormalized for RLS |
| name | text NOT NULL | Display name |
| file_name | text | Original filename |
| storage_path | text | Supabase Storage path |
| mime_type | text | application/pdf |
| file_size_bytes | bigint | |
| document_type | enum | spec, drawing, submittal, other |
| discipline | text | architectural, structural, MEP, etc. |
| status | enum | pending, processing, ready, failed |
| page_count | int | Set after processing |
| error_message | text | If status = failed |
| uploaded_by | uuid FK | → profiles |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `document_pages`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| document_id | uuid FK | → documents |
| page_number | int NOT NULL | 1-indexed |
| sheet_number | text | e.g. "A-101" |
| sheet_title | text | e.g. "FIRST FLOOR PLAN" |
| text_content | text | Full page text |
| image_storage_path | text | Rendered page PNG path |
| metadata | jsonb | Extraction metadata |
| created_at | timestamptz | |
| UNIQUE(document_id, page_number) | | |

#### `chunks`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| document_id | uuid FK | → documents |
| document_page_id | uuid FK | → document_pages (nullable) |
| project_id | uuid FK | Denormalized for search scope |
| organization_id | uuid FK | Denormalized for RLS |
| chunk_index | int | Order within document |
| content | text NOT NULL | Chunk text |
| content_type | enum | text, table, note, title_block |
| token_count | int | |
| embedding | vector(1536) | pgvector |
| metadata | jsonb | section heading, bbox, etc. |
| created_at | timestamptz | |

**Indexes:** HNSW on `embedding` using `vector_cosine_ops`; btree on `(project_id)`, `(document_id)`.

#### `issues`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK | → projects |
| organization_id | uuid FK | |
| agent_run_id | uuid FK | → agent_runs (nullable) |
| issue_type | enum | drawing_spec_conflict, missing_info, code_conflict, coordination, other |
| severity | enum | low, medium, high, critical |
| status | enum | open, acknowledged, resolved, dismissed |
| summary | text NOT NULL | |
| description | text | |
| evidence | jsonb | Array of {chunk_id, document_id, page_number, excerpt} |
| draft_rfi | text | Pre-written RFI question |
| created_by | uuid FK | NULL if agent-created |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `rfis`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK | → projects |
| organization_id | uuid FK | |
| issue_id | uuid FK | → issues (nullable, if promoted from issue) |
| rfi_number | text | Project-assigned number |
| subject | text NOT NULL | |
| question | text NOT NULL | |
| status | enum | draft, submitted, answered, closed |
| response | text | |
| created_by | uuid FK | → profiles |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `submittals`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK | → projects |
| organization_id | uuid FK | |
| document_id | uuid FK | → documents (the submittal PDF) |
| submittal_number | text | |
| spec_section | text | e.g. "08 71 00" |
| title | text NOT NULL | |
| review_status | enum | pending, pass, warning, fail |
| review_summary | text | Agent-generated summary |
| review_findings | jsonb | Array of {severity, requirement, submittal_text, spec_reference} |
| reviewed_at | timestamptz | |
| agent_run_id | uuid FK | → agent_runs |
| created_by | uuid FK | → profiles |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `agent_runs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK | → projects |
| organization_id | uuid FK | |
| agent_type | enum | rfi_scan, submittal_review, document_process |
| status | enum | pending, running, completed, failed |
| input_params | jsonb | Job configuration |
| output_summary | jsonb | Counts, top findings, etc. |
| error_message | text | |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| triggered_by | uuid FK | → profiles |
| created_at | timestamptz | |

### 3.3 Enums Summary

```sql
member_role:          owner | admin | member | viewer
project_status:       active | archived
document_type:        spec | drawing | submittal | other
document_status:      pending | processing | ready | failed
chunk_content_type:   text | table | note | title_block
issue_type:           drawing_spec_conflict | missing_info | code_conflict | coordination | other
issue_severity:       low | medium | high | critical
issue_status:         open | acknowledged | resolved | dismissed
rfi_status:           draft | submitted | answered | closed
submittal_review:     pending | pass | warning | fail
agent_type:           rfi_scan | submittal_review | document_process
agent_run_status:     pending | running | completed | failed
```

### 3.4 Vector Search Function

```sql
match_chunks(
  query_embedding vector(1536),
  match_project_id uuid,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.7
)
→ Returns chunks with similarity score, joined page/sheet metadata
```

---

## 4. API Routes

### 4.1 Next.js Route Handlers (`/apps/web`)

All routes require authenticated Supabase session unless noted.

#### Auth & Organization

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/callback` | Supabase OAuth/magic link callback |
| GET | `/api/me` | Current user profile + org memberships |
| POST | `/api/organizations` | Create organization |
| GET | `/api/organizations/:orgId` | Get organization details |
| PATCH | `/api/organizations/:orgId` | Update organization |
| GET | `/api/organizations/:orgId/members` | List members |
| POST | `/api/organizations/:orgId/members` | Invite/add member |
| DELETE | `/api/organizations/:orgId/members/:userId` | Remove member |

#### Projects

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/organizations/:orgId/projects` | List projects |
| POST | `/api/organizations/:orgId/projects` | Create project |
| GET | `/api/projects/:projectId` | Get project |
| PATCH | `/api/projects/:projectId` | Update project |
| DELETE | `/api/projects/:projectId` | Archive/delete project |

#### Documents

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/:projectId/documents` | List documents |
| POST | `/api/projects/:projectId/documents/upload-url` | Get signed upload URL |
| POST | `/api/projects/:projectId/documents` | Create document record after upload |
| GET | `/api/projects/:projectId/documents/:documentId` | Get document + status |
| DELETE | `/api/projects/:projectId/documents/:documentId` | Delete document + chunks |
| GET | `/api/projects/:projectId/documents/:documentId/pages` | List pages with metadata |
| GET | `/api/projects/:projectId/documents/:documentId/download-url` | Signed download URL |

#### Chat

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/projects/:projectId/chat` | RAG chat (streaming SSE) |
| GET | `/api/projects/:projectId/chat/history` | Chat history (MVP: optional) |

**Request body (chat):**
```json
{
  "message": "What does the spec say about door hardware?",
  "document_ids": ["uuid"]  // optional filter
}
```

**Response (streaming chunks + final):**
```json
{
  "answer": "...",
  "citations": [
    {
      "chunk_id": "uuid",
      "document_id": "uuid",
      "document_name": "Spec Section 08 71 00",
      "page_number": 12,
      "sheet_number": null,
      "excerpt": "...",
      "similarity": 0.89
    }
  ]
}
```

#### Issues & RFIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/:projectId/issues` | List issues |
| GET | `/api/projects/:projectId/issues/:issueId` | Get issue |
| PATCH | `/api/projects/:projectId/issues/:issueId` | Update status/severity |
| POST | `/api/projects/:projectId/issues/:issueId/promote-rfi` | Create RFI from issue |
| GET | `/api/projects/:projectId/rfis` | List RFIs |
| POST | `/api/projects/:projectId/rfis` | Create RFI manually |
| GET | `/api/projects/:projectId/rfis/:rfiId` | Get RFI |
| PATCH | `/api/projects/:projectId/rfis/:rfiId` | Update RFI |

#### Submittals

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/:projectId/submittals` | List submittals |
| POST | `/api/projects/:projectId/submittals` | Create submittal record |
| GET | `/api/projects/:projectId/submittals/:submittalId` | Get submittal + review |
| POST | `/api/projects/:projectId/submittals/:submittalId/review` | Trigger review agent |

#### Agents

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/projects/:projectId/agents/rfi-scan` | Trigger "Find Potential RFIs" |
| GET | `/api/projects/:projectId/agent-runs` | List agent runs |
| GET | `/api/projects/:projectId/agent-runs/:runId` | Get run status + output |

**RFI scan response:**
```json
{
  "agent_run_id": "uuid",
  "status": "running"
}
```

**Agent run completed output (issues created asynchronously):**
```json
{
  "issues_created": 7,
  "by_severity": { "high": 2, "medium": 3, "low": 2 }
}
```

#### Webhooks (internal)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/webhooks/trigger` | Trigger.dev completion callbacks |
| POST | `/api/webhooks/supabase` | Storage events (optional) |

### 4.2 FastAPI Endpoints (`/apps/processor`)

Authenticated via shared `X-API-Key` header (service-to-service).

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Health check |
| POST | `/process/document` | Full document processing pipeline |
| POST | `/process/embed` | Batch embed text chunks |
| POST | `/extract/page-metadata` | Sheet number/title detection |
| POST | `/agents/rfi-scan` | RFI contradiction detection (called by Trigger.dev) |
| POST | `/agents/submittal-review` | Submittal vs spec comparison |

**POST `/process/document` request:**
```json
{
  "document_id": "uuid",
  "storage_path": "org/project/doc.pdf",
  "project_id": "uuid",
  "options": {
    "chunk_size_tokens": 512,
    "chunk_overlap_tokens": 64,
    "generate_page_images": true
  }
}
```

**POST `/process/document` response:**
```json
{
  "page_count": 42,
  "pages": [
    {
      "page_number": 1,
      "sheet_number": "G-001",
      "sheet_title": "COVER SHEET",
      "text_content": "...",
      "image_path": "org/project/pages/doc_p1.png"
    }
  ],
  "chunks": [
    {
      "chunk_index": 0,
      "page_number": 1,
      "content": "...",
      "content_type": "text",
      "embedding": [0.01, ...],
      "metadata": { "section": "GENERAL REQUIREMENTS" }
    }
  ]
}
```

**POST `/agents/rfi-scan` response issue schema:**
```json
{
  "issues": [
    {
      "issue_type": "drawing_spec_conflict",
      "severity": "high",
      "summary": "Door hardware set mismatch between drawing A-101 and Spec 08 71 00",
      "evidence": [
        {
          "chunk_id": "uuid",
          "document_id": "uuid",
          "page_number": 12,
          "excerpt": "Hardware Group 1: Schlage L9000..."
        }
      ],
      "draft_rfi": "Please clarify which door hardware set applies to Room 104..."
    }
  ]
}
```

**POST `/agents/submittal-review` response:**
```json
{
  "review_status": "warning",
  "summary": "Submittal partially complies; finish does not match spec.",
  "findings": [
    {
      "severity": "warning",
      "requirement": "Finish shall be 626 satin chrome per Spec 08 71 00 §2.1",
      "submittal_text": "Finish: 630 satin stainless",
      "spec_reference": { "chunk_id": "uuid", "page_number": 8 }
    }
  ]
}
```

### 4.3 Trigger.dev Jobs (`/apps/jobs`)

| Job ID | Trigger | Steps |
|--------|---------|-------|
| `document.process` | Document record created | Download PDF → FastAPI process → Write DB → Update status |
| `agent.rfi-scan` | POST rfi-scan API | Fetch chunks → FastAPI agent → Create issues → Update agent_run |
| `agent.submittal-review` | POST submittal review | Ensure doc processed → FastAPI agent → Update submittal |
| `document.reprocess` | Manual retry | Re-run processing for failed docs |

---

## 5. Folder Structure

```
construction/
├── apps/
│   ├── web/                          # Next.js 15 application
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                    # Org project list
│   │   │   │   ├── settings/
│   │   │   │   └── projects/
│   │   │   │       └── [projectId]/
│   │   │   │           ├── page.tsx            # Project overview
│   │   │   │           ├── documents/
│   │   │   │           ├── chat/
│   │   │   │           ├── issues/
│   │   │   │           ├── rfis/
│   │   │   │           └── submittals/
│   │   │   ├── api/
│   │   │   │   ├── me/
│   │   │   │   ├── organizations/
│   │   │   │   ├── projects/
│   │   │   │   └── webhooks/
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/                             # shadcn/ui primitives
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── documents/
│   │   │   │   ├── upload-dropzone.tsx
│   │   │   │   └── document-status-badge.tsx
│   │   │   ├── chat/
│   │   │   │   ├── chat-panel.tsx
│   │   │   │   └── citation-card.tsx
│   │   │   ├── agents/
│   │   │   │   ├── rfi-scan-button.tsx
│   │   │   │   └── agent-run-status.tsx
│   │   │   ├── issues/
│   │   │   │   └── issue-card.tsx
│   │   │   └── submittals/
│   │   │       └── review-result.tsx
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts
│   │   │   │   ├── server.ts
│   │   │   │   └── middleware.ts
│   │   │   ├── api/                            # Route handler helpers
│   │   │   ├── auth/
│   │   │   └── utils/
│   │   ├── hooks/
│   │   ├── middleware.ts                       # Auth guard
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── processor/                    # FastAPI document processor
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── dependencies.py                 # API key auth
│   │   │   ├── routers/
│   │   │   │   ├── health.py
│   │   │   │   ├── process.py
│   │   │   │   └── agents.py
│   │   │   ├── services/
│   │   │   │   ├── pdf_extractor.py            # pdfplumber
│   │   │   │   ├── page_renderer.py            # pymupdf
│   │   │   │   ├── sheet_detector.py
│   │   │   │   ├── chunker.py
│   │   │   │   ├── embedder.py
│   │   │   │   ├── rfi_agent.py
│   │   │   │   └── submittal_agent.py
│   │   │   └── models/
│   │   │       ├── requests.py
│   │   │       └── responses.py
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   └── requirements.txt
│   │
│   └── jobs/                         # Trigger.dev background jobs
│       ├── src/
│       │   ├── trigger/
│       │   │   ├── document-process.ts
│       │   │   ├── rfi-scan.ts
│       │   │   └── submittal-review.ts
│       │   ├── lib/
│       │   │   ├── supabase-admin.ts
│       │   │   └── processor-client.ts
│       │   └── index.ts
│       ├── trigger.config.ts
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared TypeScript types & constants
│       ├── src/
│       │   ├── types/
│       │   │   ├── database.ts                 # Generated from Supabase
│       │   │   ├── agents.ts
│       │   │   └── api.ts
│       │   └── constants/
│       │       └── enums.ts
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql                              # Dev seed data
│
├── docs/
│   └── TECHNICAL_DESIGN.md                   # This document
│
├── .github/
│   └── workflows/
│       ├── ci-web.yml
│       ├── ci-processor.yml
│       └── deploy-processor.yml
│
├── turbo.json
├── package.json                              # Workspace root
├── pnpm-workspace.yaml
└── README.md
```

---

## 6. Supabase Configuration

### 6.1 Storage Buckets

| Bucket | Path Pattern | Access |
|--------|--------------|--------|
| `documents` | `{org_id}/{project_id}/documents/{doc_id}.pdf` | Org members read/write |
| `page-images` | `{org_id}/{project_id}/pages/{doc_id}_p{n}.png` | Org members read; service write |

### 6.2 RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Own row + org co-members | Own row | Own row | — |
| organizations | Member of org | Authenticated (creates self as owner) | Admin+ | Owner |
| organization_members | Same org | Admin+ | Admin+ | Admin+ |
| projects | Same org | Member+ | Member+ | Admin+ |
| documents | Same org | Member+ | Member+ | Admin+ |
| document_pages | Same org | Service role only | Service role | Cascade |
| chunks | Same org | Service role only | Service role | Cascade |
| issues | Same org | Member+ | Member+ | Admin+ |
| rfis | Same org | Member+ | Member+ | Admin+ |
| submittals | Same org | Member+ | Member+ | Admin+ |
| agent_runs | Same org | Member+ | Service role | — |

Helper function: `is_org_member(org_id uuid)` → checks `organization_members` for `auth.uid()`.

### 6.3 Environment Variables

**apps/web:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
TRIGGER_SECRET_KEY
PROCESSOR_API_URL
PROCESSOR_API_KEY
```

**apps/processor:**
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
PROCESSOR_API_KEY
```

**apps/jobs:**
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PROCESSOR_API_URL
PROCESSOR_API_KEY
TRIGGER_SECRET_KEY
OPENAI_API_KEY
```

---

## 7. MVP Implementation Phases

### Phase 1 — Foundation (Week 1–2)
- Monorepo scaffold, Supabase project, auth + org CRUD
- Projects CRUD, document upload to Storage

### Phase 2 — Document Pipeline (Week 2–3)
- FastAPI processor, Trigger.dev job, chunk + embed storage
- Document status UI

### Phase 3 — Project Chat (Week 3–4)
- Vector search function, RAG chat with citations
- Chat UI with citation cards

### Phase 4 — RFI Agent (Week 4–5)
- RFI scan agent, issues list UI, promote to RFI

### Phase 5 — Submittal Review (Week 5–6)
- Submittal upload flow, review agent, pass/warn/fail UI

---

## 8. Open Questions

1. **Chat persistence** — Store chat history in MVP or defer to v2?
2. **Drawing OCR** — Scanned PDFs may need OCR; add in Phase 2 or post-MVP?
3. **Agent model** — Claude for long-context agent work vs GPT-4o only?
4. **Issue deduplication** — Should RFI scan merge similar findings?
5. **Billing** — Per-org document page limits for MVP?

---

## 9. Appendix: Issue Output Schema (Agent Contract)

```typescript
interface AgentIssue {
  issue_type:
    | "drawing_spec_conflict"
    | "missing_info"
    | "code_conflict"
    | "coordination"
    | "other";
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  evidence: Array<{
    chunk_id?: string;
    document_id: string;
    page_number: number;
    sheet_number?: string;
    excerpt: string;
  }>;
  draft_rfi: string;
}
```

```typescript
interface SubmittalReviewResult {
  review_status: "pass" | "warning" | "fail";
  summary: string;
  findings: Array<{
    severity: "info" | "warning" | "fail";
    requirement: string;
    submittal_text: string;
    spec_reference: {
      chunk_id: string;
      document_id: string;
      page_number: number;
      excerpt: string;
    };
  }>;
}
```
