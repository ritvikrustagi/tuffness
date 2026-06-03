# Document Processor (FastAPI)

PDF ingestion worker for AI Project Engineer.

## Pipeline

1. Download PDF from Supabase Storage (`documents` bucket)
2. Extract text per page with **pdfplumber** (includes tables)
3. Render page images with **pymupdf** (PyMuPDF)
4. Detect sheet number/title from title block heuristics
5. Chunk text by page with token overlap
6. Generate embeddings via OpenAI `text-embedding-3-small`
7. Write `document_pages`, `chunks` (with vectors), update document status

## Setup

```bash
cd apps/processor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with Supabase, OpenAI, and API key values
uvicorn app.main:app --reload --port 8000
```

Use the same `PROCESSOR_API_KEY` in both `.env` files (processor + web app).

## API

| Method | Route | Auth |
|--------|-------|------|
| GET | `/health` | None |
| POST | `/process/document` | `X-API-Key` header |

### POST `/process/document`

```json
{
  "document_id": "uuid",
  "storage_path": "org_id/project_id/documents/doc_id.pdf",
  "project_id": "uuid",
  "organization_id": "uuid",
  "options": {
    "chunk_size_tokens": 512,
    "chunk_overlap_tokens": 64,
    "generate_page_images": true
  }
}
```

## Docker

```bash
docker build -t ai-project-engineer-processor .
docker run -p 8000:8000 --env-file .env ai-project-engineer-processor
```
