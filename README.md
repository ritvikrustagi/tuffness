# AI Project Engineer

AI-native construction platform for RFI and Submittal Review.

## Phase 1

- Next.js app with Supabase Auth (email/password)
- Organization-based multi-tenancy
- Projects CRUD
- PDF document upload to Supabase Storage

## Phase 5 (current)

- Controlled Submittal Review agent (spec vs submittal comparison)
- Upload submittal PDFs, process via existing pipeline, review against spec chunks
- Structured review results + linked issues for fail/high-severity items
- Submittals tab at `/projects/:id/submittals`

## Phase 4

- Controlled RFI agent (deterministic retrieval + structured LLM output)
- Creates draft issues + linked draft RFIs for human review
- Issues tab at `/projects/:id/issues`

## Phase 3

- pgvector semantic search via `match_chunks()`
- Project chat with streaming RAG answers and citations
- Chat UI at `/projects/:id/chat`

## Phase 2

- FastAPI document processor (`apps/processor`)
- pdfplumber text extraction + pymupdf page images
- Sheet number/title detection, chunking, OpenAI embeddings
- Chunks stored in Postgres with pgvector
- Auto-processing triggered after upload

## Prerequisites

- Node.js 20+
- Python 3.12+
- A [Supabase](https://supabase.com) project
- OpenAI API key (embeddings + chat)

## Setup

### 1. Apply database migrations

Run in Supabase SQL Editor (in order):

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_storage.sql`
3. `supabase/migrations/003_page_images_storage.sql`
4. `supabase/migrations/004_rfi_agent_type.sql`
5. `supabase/migrations/005_submittal_review.sql`

### 2. Configure Supabase Auth

- Enable **Email** provider
- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`

### 3. Start the document processor

```bash
cd apps/processor
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, PROCESSOR_API_KEY
uvicorn app.main:app --reload --port 8000
```

### 4. Start the web app

```bash
cd apps/web
cp .env.local.example .env.local
# Set Supabase keys + PROCESSOR_API_URL=http://localhost:8000 + PROCESSOR_API_KEY
# Set OPENAI_API_KEY (+ optional OPENAI_CHAT_MODEL, OPENAI_EMBEDDING_MODEL)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Chat flow (Phase 3)

1. Upload and process PDFs (status `ready`)
2. Open project → **Chat** tab
3. Ask a question → query is embedded → pgvector retrieves top chunks
4. LLM answers with inline citations `[1]`, `[2]` and source cards below

## Vector search API

Debug/search endpoint for retrieved chunks:

```
GET /api/projects/:projectId/search?q=door+hardware&limit=8&threshold=0.55
```

## Document processing flow

1. User uploads PDF → stored in Supabase Storage
2. Web app creates `documents` row (`pending`)
3. Web app calls processor `POST /process/document`
4. Processor sets status `processing` → extracts pages → embeds chunks → `ready`

## Project structure

```
construction/
├── apps/web/           # Next.js application
├── apps/processor/     # FastAPI PDF ingestion worker
├── supabase/migrations/
├── tools/              # Local helper automations
└── docs/
```

## Local automations

This repo includes a macOS helper that moves new completed files from `~/Downloads` to iCloud Drive in the background. See `tools/downloads_to_icloud/README.md` for install, uninstall, and troubleshooting steps.

## Submittal review flow (Phase 5)

1. Upload spec PDFs on Documents tab (`document_type: spec`)
2. Open Submittals tab → upload submittal PDF with category
3. Wait for submittal processing (`ready`)
4. Click **Review Against Specs**
5. Review structured results — human approval required

## Next phases

All MVP phases complete. See `docs/TECHNICAL_DESIGN.md` for future enhancements.

See `docs/TECHNICAL_DESIGN.md` for full architecture.
