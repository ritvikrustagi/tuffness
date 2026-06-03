# Dashboard, Source Viewer, and RFI Editor Spec

Date: 2026-06-03
Status: Approved for implementation
Context: AI Project Engineer MVP. The current app already supports project documents, chat, AI RFI scan, issue workflow, manual RFI export, and submittal review.

## 1. Goal

Make the product feel more like a usable construction command center instead of separate upload/chat/RFI pages.

This slice adds three high-leverage product features:

1. Project dashboard as the project home.
2. Source viewer for cited document evidence.
3. Better RFI editor with structured subject/question/background/references.

## 2. Non-Goals

- Full PDF rendering or drawing markup.
- Direct Procore/Autodesk writeback.
- Real-time collaboration.
- A new AI agent.
- Full audit trail.
- Moving every route or redesigning the whole app shell.

## 3. Feature: Project Dashboard

### User Need

A project engineer opening a project needs an immediate answer to:

- Are my documents ready?
- What issues need attention?
- What draft RFIs are waiting?
- What submittals need review?
- What changed recently?

### Requirements

The project home route `/projects/:projectId` becomes an overview dashboard.

Dashboard sections:

- Document readiness summary:
  - Total documents
  - Ready
  - Processing/pending
  - Failed
- RFI workflow summary:
  - Open issues
  - Draft RFIs
  - Submitted RFIs
  - Answered awaiting closeout
  - Closed
- Submittal summary:
  - Total submittals
  - Pending
  - Pass
  - Warning
  - Fail
- Recent activity:
  - Recent documents
  - Recent issues/RFIs
  - Recent submittals
- Actions:
  - Upload documents
  - Ask a question
  - Find potential RFIs
  - Review submittals

### Navigation

Project tabs become:

- Overview: `/projects/:projectId`
- Documents: `/projects/:projectId/documents`
- Chat: `/projects/:projectId/chat`
- RFIs: `/projects/:projectId/issues`
- Submittals: `/projects/:projectId/submittals`

The existing document library moves to `/projects/:projectId/documents`.

## 4. Feature: Source Viewer

### User Need

When the product cites a document/page, the user needs a quick way to inspect the source without manually searching the PDF.

### Requirements

Evidence cards on RFI/issue records should have a source action.

Behavior:

- User clicks a citation/evidence source.
- UI opens an inline source panel for that document/page.
- Source panel shows:
  - Document name
  - Page number
  - Sheet number/title when available
  - Page text excerpt
  - Page image link/preview if the processor has `image_storage_path`
- If no page is found, show a clear unavailable state.

API:

- `GET /api/projects/:projectId/documents/:documentId/pages/:pageNumber`
- Confirms project access.
- Reads `document_pages` joined through the project document.
- Returns page metadata, text content, and a signed image URL when available.

Non-goal:

- Do not build a full PDF viewer in this slice.

## 5. Feature: Better RFI Editor

### User Need

The current editor has a draft text box, but a real project engineer thinks in RFI fields:

- Subject
- Question
- Background/context
- References/evidence
- External tracking
- Response/resolution

### Requirements

The issue workflow editor should be reorganized into clearer sections:

- Workflow:
  - Workflow state
  - Trade
  - Discipline
  - Due date
- RFI draft:
  - Subject
  - Question
  - Background/context
  - References/evidence visible nearby
- External tracking:
  - External RFI number
  - External RFI URL
  - External issue URL
- Closeout:
  - Response
  - Resolution notes

Editable fields:

- RFI subject
- RFI question
- Background/context
- Workflow metadata
- External tracking
- Response
- Resolution notes

Persistence:

- `subject` updates the linked RFI subject.
- `draft_rfi` updates the linked RFI question and issue draft text.
- `description` updates issue background/context.

Manual export:

- Export text should include subject, question, background, references/evidence, metadata, and external tracking.

## 6. Acceptance Criteria

Dashboard:

- Project home shows overview cards and recent activity.
- Document library is accessible from a Documents tab.
- Existing upload flow still works.

Source viewer:

- Evidence cards can open source page details.
- Source API returns page metadata/text and signed image URL when available.
- Missing pages return a user-friendly state.

RFI editor:

- Editor has clear sections.
- Subject and background/context can be saved.
- Export includes the structured fields.

Verification:

- Unit tests cover dashboard summaries and RFI export structure.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
