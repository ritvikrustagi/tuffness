# Risk Detail Review Workspace Design

## Goal

Give GC project engineers a focused page for one AI Risk + Compliance Register item so they can inspect evidence, edit risk/compliance metadata, manage workflow state, copy a compliance packet, and explicitly mark the item reviewed.

## User Experience

The register list links each item to `/projects/[projectId]/risks/[issueId]`. The detail page shows the risk summary, tier, score, confidence, status, compliance impact, required artifact, spec section, drawing sheet, responsible party, evidence, source viewer, recommended action, workflow controls, editable metadata, and review status.

The page uses the existing issue workflow form for RFI state and external tracking. It adds a risk/compliance editor for metadata that matters to compliance triage. A `Mark reviewed` action records human review even when no metadata changes are needed.

## Architecture

No new tables are required. The detail page reads the selected issue with `rfis(*)` from Supabase and reuses the existing issue PATCH endpoint. The PATCH payload accepts workflow fields, risk metadata fields, and a new `reviewed: true` flag.

The SQL RPC keeps workflow and metadata updates atomic. Metadata edits continue to set `human_reviewed_at` and `human_reviewed_by`. The new `reviewed` flag lets the RPC set those review fields without requiring a metadata field change.

## Testing

Unit tests cover review payload validation and RPC patch generation. Existing workflow RPC tests continue to guard metadata-only updates from workflow side effects. Full verification is `npm test --workspace=web`, `npm run lint`, `npm run build`, and `git diff --check`.
