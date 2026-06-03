# AI RFI Copilot Startup Spec

Date: 2026-06-03
Status: Draft for founder review
Repo context: Existing Next.js + Supabase + FastAPI PDF ingestion app with project documents, chat, RFI issue detection, and submittal review primitives.

## 1. Product Thesis

Construction teams lose money because critical project information is trapped across plans, specs, RFIs, submittals, addenda, and meeting notes. The first wedge should not be a generic "AI document chat" tool. It should be an AI RFI copilot that helps project engineers and supers find ambiguous or conflicting requirements before those conflicts become schedule delays, change orders, or rework.

The MVP promise:

> Upload a project plan/spec set, ask questions with citations, and generate draft RFIs from document conflicts in minutes.

The long-term product is an AI project engineer that continuously reads project documents, detects coordination risk, drafts construction admin artifacts, and tracks open issues until they are resolved.

## 2. Initial Customer

Primary ICP:

- General contractors and subcontractors doing commercial projects from roughly $5M to $250M.
- Teams with dedicated project engineers, assistant PMs, project managers, and supers.
- Organizations that already manage RFIs/submittals in Procore, Autodesk Build, Bluebeam, SharePoint, or email, but still review documents manually.

Primary user:

- Project engineer responsible for reading specs, reviewing drawings, preparing RFIs, and chasing answers.

Economic buyer:

- VP Operations, Director of Construction Technology, or PM leader who owns project delivery margin and schedule risk.

Why this wedge wins:

- RFI creation is frequent, painful, and easy to understand.
- The output is reviewable before submission, which fits AI trust constraints.
- Cited evidence creates an audit trail.
- It can be piloted on a single active project without replacing Procore or Autodesk on day one.

## 3. Problem

Project teams spend hours comparing plans and specs to answer questions like:

- Does the drawing conflict with the specification?
- Is a product requirement missing?
- Which spec section governs this detail?
- Is this submittal compliant?
- Has this issue already been asked as an RFI?
- Which open issues affect this trade or area?

The manual workflow is slow because:

- PDFs are large, fragmented, and updated frequently.
- Requirements are repeated across drawings, schedules, notes, and specs.
- Conflicts are often discovered late by field teams.
- RFIs must be carefully worded, evidence-backed, and formatted for the owner/design team.
- Existing systems track records, but do not reason across the documents.

## 4. MVP Scope

The MVP should focus on three workflows:

1. PDF ingestion
2. Project chat with citations
3. Draft RFI generation from conflicts and missing information

Everything else should support those workflows, not distract from them.

### In Scope

- Organization and project workspace.
- Upload plans, specs, addenda, existing RFIs, and submittals as PDFs.
- Document processing with page text, sheet metadata, chunks, embeddings, and page image references.
- Project-level chat over processed documents.
- AI RFI scan that finds a small number of high-confidence potential RFIs.
- Draft RFI editor with cited evidence.
- Issue tracker for open AI findings and human-created issues.
- Human approval before any RFI leaves the product.
- Export/copy draft RFI for Procore, Autodesk, email, or another system.

### Out of Scope for MVP

- Direct Procore/Autodesk writeback.
- Full drawing markup.
- Real-time collaborative editing.
- Native mobile app.
- BIM/IFC model reasoning.
- Fully automated RFI submission.
- Legal/code compliance guarantees.
- Fine-tuned models.

## 5. Product Surface

### 5.1 Project Dashboard

The project dashboard should answer:

- What documents are uploaded?
- Are they processed and searchable?
- What high-severity issues are open?
- How many draft RFIs are waiting for review?
- What changed recently?

Expected modules:

- Document readiness summary.
- Open issues by severity.
- Draft RFIs awaiting review.
- Recent uploads and agent runs.
- Calls to action: upload documents, ask a question, run RFI scan.

### 5.2 Document Library

Users upload and classify PDFs:

- Plans
- Specs
- RFIs
- Submittals
- Addenda
- Other

Document fields:

- Name
- File name
- Document type
- Discipline
- Revision/date, if known
- Processing status
- Page count
- Error message, if failed

Processing must produce:

- Page text
- Page images
- Sheet number and sheet title when detectable
- Searchable chunks
- Vector embeddings
- Metadata including spec section, drawing sheet, discipline, and page references when available

MVP quality bar:

- Users can tell which files are ready.
- Failed processing is visible and retryable.
- Answers and draft RFIs cite document name and page number.

### 5.3 Project Chat

Chat is not the product by itself. It is the fastest way for a project engineer to interrogate the document set.

Core behavior:

- User asks a project-specific question.
- System retrieves relevant chunks scoped to the project.
- Answer includes citations with document name, page number, and quoted evidence.
- Answer admits uncertainty when evidence is weak.
- User can open cited source context.

Example questions:

- "What door hardware is required for stair doors?"
- "Does the spec require low-VOC paint?"
- "Find the waterproofing requirements for balconies."
- "What is the submittal requirement for HVAC equipment?"
- "Does sheet A601 conflict with the door schedule?"

MVP guardrails:

- No answer without retrieved project evidence.
- No fabricated sheet numbers, spec sections, or citations.
- If the documents are not processed, chat should say so and direct the user to upload/process documents.

### 5.4 RFI Issue Detection

The RFI scan should produce a limited number of high-confidence issues instead of flooding the user.

Detection targets:

- Drawing/spec conflicts
- Missing information
- Coordination conflicts across disciplines
- Apparent code/spec conflicts when supported by project documents
- Ambiguous requirements that need design team clarification

Inputs:

- Project id
- Optional document filters
- Optional discipline/trade
- Optional scan mode: quick scan, deep scan, or section-specific scan

Output per issue:

- Issue type
- Severity
- Summary
- Detailed description
- Evidence citations
- Confidence level
- Suggested assignee/trade, if inferable
- Draft RFI question
- Recommended next action

MVP constraints:

- Cap each run to a small number of findings, such as 5, to preserve trust.
- Only create draft issues/RFIs.
- Every finding must have evidence.
- Human can dismiss, edit, approve, or convert to a formal RFI.

### 5.5 Draft RFI Generation

Draft RFIs should be usable by a project engineer with light editing.

Draft structure:

- Subject
- Question
- Background/context
- Cited references
- Suggested urgency/severity
- Suggested trade/discipline
- Impact note, if supported by evidence

Good draft RFI style:

- Neutral and professional.
- Short enough for real construction workflows.
- Asks one clear question.
- Quotes or references the exact conflicting requirement.
- Avoids legal conclusions and unsupported schedule/cost claims.

Human review states:

- Draft
- Needs edit
- Approved for external submission
- Submitted externally
- Answered
- Closed

For MVP, "submitted externally" can be a manual status because direct integration is out of scope.

### 5.6 Issue Tracker

Issues are the operational backbone. RFIs are one possible output from an issue.

Issue fields:

- Type
- Severity
- Status
- Summary
- Description
- Evidence
- Linked draft RFI
- Linked submittal, when relevant
- Source agent run
- Owner
- Due date
- Trade/discipline
- Resolution notes

Statuses:

- Open
- Acknowledged
- Draft RFI
- Submitted
- Answered
- Resolved
- Dismissed

MVP may map these onto the current simpler status model, but the product spec should preserve the fuller lifecycle.

## 6. Expansion Features

These features make the product feel like a startup rather than a demo, but should be sequenced after the RFI wedge is working.

### 6.1 Submittal Review

The system compares a submitted PDF against relevant spec requirements.

Output:

- Overall result: approved, approved as noted, revise and resubmit, rejected.
- Requirement-by-requirement findings.
- Submitted value vs required value.
- Evidence from both submittal and spec.
- Recommendations for reviewer comments.
- Linked issue creation for high-severity failures.

This should become the second commercial module after RFI copilot.

### 6.2 Revision Awareness

Construction documents change. The product needs revision intelligence.

Future capabilities:

- Detect document revisions and superseded files.
- Compare old vs new drawing/spec versions.
- Show which open issues may be affected by a new addendum.
- Re-run targeted scans when new documents arrive.
- Prevent agents from relying on superseded documents unless explicitly asked.

### 6.3 Integration Layer

MVP can export/copy. Paid pilots will eventually demand integrations.

Priority integrations:

- Procore RFI read/write
- Autodesk Build RFIs/submittals
- Bluebeam Studio or drawing links
- SharePoint/OneDrive document sync
- Email intake for RFI answers and addenda

Integration principle:

- The product should remain useful without integrations, but become sticky with them.

### 6.4 Continuous Project Monitor

Instead of only user-triggered scans, the system can monitor project document changes.

Examples:

- New addendum uploaded: identify affected open RFIs/issues.
- New submittal uploaded: suggest relevant spec sections.
- RFI answer uploaded: mark related issue ready for review.
- Spec change detected: flag likely affected submittals.

This becomes the "AI project engineer" narrative.

### 6.5 Collaboration and Accountability

Future collaboration features:

- Assign issues to team members.
- Comment threads on issues/RFIs.
- Due dates and aging.
- Watchers.
- Audit log.
- Weekly risk digest.
- Project-level analytics.

## 7. AI System Requirements

### 7.1 Retrieval

Retrieval must be deterministic enough for construction workflows.

Requirements:

- Scope all retrieval by organization and project.
- Support filters by document type, discipline, and document ids.
- Prefer exact metadata matches when available, such as sheet number or spec section.
- Use semantic retrieval for broad questions.
- Return source chunks with stable ids and document/page metadata.
- Preserve enough quote text for evidence review.

Future improvements:

- Hybrid lexical + vector search.
- Reranking.
- Section hierarchy extraction for specs.
- Drawing title block parsing.
- Table extraction for schedules.

### 7.2 Prompting and Output

Agent outputs should be structured and validated.

RFI agent output:

- `issues[]`
- `issue_type`
- `severity`
- `summary`
- `description`
- `evidence[]`
- `draft_rfi`
- `confidence`

Submittal agent output:

- `overall_status`
- `summary`
- `items[]`
- `requirement`
- `submitted_value`
- `status`
- `severity`
- `evidence[]`
- `recommendation`

Validation rules:

- Reject outputs without citations.
- Reject findings where evidence does not include project document ids.
- Cap summary and draft lengths.
- Store raw agent output for audit/debugging.

### 7.3 Trust and Safety

The product must frame AI as a copilot, not an authority.

Rules:

- AI drafts only. Humans approve.
- Every material claim needs a citation.
- If evidence is insufficient, the model should say what is missing.
- Do not claim code compliance unless the relevant code text is in the project corpus.
- Do not invent impacts, costs, or delays.
- Keep a record of prompts, inputs, outputs, model versions, and evidence ids for agent runs.

## 8. Data Model Additions

The existing schema already has organizations, projects, documents, chunks, issues, RFIs, submittals, and agent runs. To support a stronger product spec, add or plan these concepts:

### Document Revisions

Purpose:

- Track superseded documents and addenda.

Fields:

- `revision_label`
- `revision_date`
- `supersedes_document_id`
- `is_current`
- `source_package_id`

### Document Packages

Purpose:

- Group uploads into plan sets, spec books, addenda, or submittal packages.

Fields:

- `name`
- `package_type`
- `received_date`
- `uploaded_by`
- `status`

### Issue Ownership

Purpose:

- Turn findings into accountable workflow.

Fields:

- `owner_id`
- `trade`
- `discipline`
- `due_date`
- `resolution_notes`
- `external_system_url`

### RFI External Tracking

Purpose:

- Let teams mirror RFI status before integrations exist.

Fields:

- `external_rfi_number`
- `external_url`
- `submitted_at`
- `answered_at`
- `answer_source_document_id`

### Agent Evidence Table

Purpose:

- Normalize citations instead of burying evidence only in JSON.

Fields:

- `agent_run_id`
- `issue_id`
- `rfi_id`
- `chunk_id`
- `document_id`
- `document_page_id`
- `quote`
- `relevance_score`

## 9. MVP User Stories

### Upload and Process Documents

As a project engineer, I can upload plan/spec PDFs to a project so the system can search and reason over them.

Acceptance criteria:

- Upload accepts PDF files.
- User chooses document type.
- Processing status is visible.
- Ready documents appear in project chat and RFI scan.
- Failed documents show a useful error and can be retried.

### Ask Project Questions

As a project engineer, I can ask questions about project documents and receive cited answers.

Acceptance criteria:

- Chat answers only from project documents.
- Citations include document name and page number.
- User can inspect source context.
- If no evidence is found, the answer says so.

### Run RFI Scan

As a project engineer, I can run an RFI scan to find likely document conflicts or missing information.

Acceptance criteria:

- Scan creates an agent run record.
- Scan returns at most a small set of findings.
- Every finding includes evidence.
- Findings become draft issues.
- Draft RFI text is generated for each actionable finding.

### Review Draft RFI

As a project engineer, I can edit, approve, dismiss, or track a draft RFI.

Acceptance criteria:

- Draft RFI is editable.
- Evidence remains visible during editing.
- User can mark the RFI approved/submitted/answered/closed.
- Dismissed issues preserve dismissal history or notes.

### Track Open Issues

As a PM or PE, I can see unresolved AI findings and RFIs for a project.

Acceptance criteria:

- Issues are filterable by severity, status, and type.
- Issues link to source evidence and draft RFIs.
- Status changes are persisted.
- High-severity issues are easy to find.

## 10. Success Metrics

Activation:

- Time from signup to first processed project.
- Percent of uploaded PDFs successfully processed.
- Percent of projects with at least one cited chat answer.
- Percent of projects with at least one generated draft RFI.

Product value:

- Draft RFIs accepted or edited rather than dismissed.
- Average time saved per RFI drafted.
- Number of document conflicts found before field impact.
- Submittal findings accepted by reviewers.
- Weekly active projects.

Trust:

- Citation click-through rate.
- Hallucination/unsupported-claim reports.
- Dismissed AI finding rate.
- Agent findings with complete evidence.

Commercial:

- Pilot-to-paid conversion.
- Active projects per account.
- Seats per project.
- Expansion from RFI module to submittal module.

## 11. Pricing Hypothesis

Initial packaging:

- Pilot: fixed fee per project for 60-90 days.
- Paid: per active project per month, with seat allowances.
- Expansion: add-on modules for submittal review and continuous monitoring.

Suggested early pricing:

- Small project pilot: $1,000-$3,000/month.
- Mid-market GC pilot: $5,000-$10,000/project for 90 days.
- Enterprise: annual platform fee plus active project usage.

Pricing should be tested against value created, not token usage.

## 12. Roadmap

### Phase 1: Credible RFI MVP

- Harden PDF ingestion.
- Improve project chat citations.
- Generate draft RFIs from issue findings.
- Add issue review workflow.
- Add export/copy for external RFI systems.

### Phase 2: Trust and Workflow

- Add document packages and revisions.
- Add issue assignment, due dates, comments, and audit log.
- Add evidence normalization.
- Add scan filters by discipline/document.
- Add better failure handling and reprocessing.

### Phase 3: Submittal Review Module

- Improve spec requirement extraction.
- Compare submittal against relevant requirements.
- Create linked issues from high-severity failures.
- Add reviewer comment generation.

### Phase 4: Integrations

- Procore import/export.
- Autodesk Build import/export.
- SharePoint/OneDrive sync.
- Email intake.

### Phase 5: Continuous Project Engineer

- Monitor new documents.
- Re-scan affected issues.
- Weekly risk digest.
- Cross-project analytics.
- Portfolio-level construction risk insights.

## 13. Implementation Notes for Existing Codebase

The current repo already contains useful primitives:

- Supabase multi-tenant schema.
- PDF ingestion service in FastAPI.
- Page rendering and chunking.
- OpenAI embeddings.
- Project chat with RAG.
- RFI agent output schema.
- Submittal review output schema.
- Issues, RFIs, submittals, and agent run tables.

Important gaps to resolve before calling this startup-ready:

- Existing architecture doc references Trigger.dev, but the repo does not currently show a Trigger.dev app. Either add it later or update architecture to match the current synchronous/API-driven implementation.
- RFI lifecycle is under-modeled for real review/submission tracking.
- Evidence is stored as JSON rather than normalized citation records.
- Document revisions and addenda are not modeled yet.
- No external system mapping exists for Procore/Autodesk.
- No strong quality/evaluation harness exists for agent outputs.
- Chat and agent trust boundaries should be stricter: no evidence, no claim.

## 14. Product Principle

Do not sell "chat with your construction documents." Sell fewer late RFIs, fewer missed conflicts, and faster project engineer workflows.

The product should feel like a careful junior project engineer that reads everything, cites its work, drafts the paperwork, and never submits without human approval.
