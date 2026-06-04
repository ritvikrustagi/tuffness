# AI Risk + Compliance Register Design

Date: 2026-06-04
Status: Draft for founder/engineering review
Context: AI Project Engineer for GC project engineers. The current branch has an AI Risk Register backed by issue metadata, evidence citations, risk scoring, required artifacts, workflow state, and draft RFI generation.

## 1. Goal

Build a Compliance Register directly on top of the AI Risk Register.

The product promise:

> Upload drawings and specs. Get a ranked AI Risk + Compliance Register showing possible spec deviations, submittal requirements, inspections/testing, owner approvals, RFIs needed, responsible party, confidence, and source evidence.

This should not feel like a legal/code-compliance engine. It should feel like a senior project engineer pre-reading the plans/specs and creating an actionable compliance worklist for the GC team.

## 2. Target User

Primary user:

- GC project engineer.

Supporting users:

- Assistant PM.
- PM.
- Superintendent.
- Project controls / VDC / operations leader evaluating a pilot.

The GC project engineer is the right first user because they already coordinate RFIs, submittals, drawing/spec review, approvals, inspections, and closeout requirements. The Compliance Register should make their daily review work faster, not introduce a separate compliance department workflow.

## 3. Problem

Compliance obligations are hidden across project documents:

- Spec sections.
- Drawing notes and schedules.
- Addenda.
- RFI answers.
- Submittal requirements.
- Testing and inspection requirements.
- Owner/design-team approval requirements.
- Closeout and turnover requirements.

Today, the PE has to manually build and maintain a mental checklist:

- Which spec sections require submittals?
- Which items require inspection or testing?
- Which approvals are needed before procurement or install?
- Which drawing notes conflict with specs?
- Which risks need RFIs?
- Who owns each requirement?
- What evidence supports the action?

Existing systems store records after humans create them. They do not reliably find the obligations before they become missed submittals, failed inspections, field rework, owner disputes, or closeout surprises.

## 4. Product Positioning

Near-term positioning:

> AI Risk + Compliance Register for GC project engineers.

Demo positioning:

> Upload plans/specs. Get the project’s highest-risk compliance obligations with citations and next actions.

Long-term positioning:

> AI project controls layer for risk, compliance, RFIs, submittals, inspections, and closeout.

The key is to keep this action-oriented. The output should be a worklist the PE can filter, assign, export, and turn into RFIs/submittal tasks, not a dense legal matrix.

## 5. Non-Goals

Out of scope for this slice:

- Certifying code compliance.
- Guaranteeing legal or AHJ approval.
- Replacing licensed design professionals.
- Full building-code interpretation beyond uploaded project evidence.
- Two-way Procore/Autodesk/Bluebeam sync.
- Full requirement extraction for every spec line.
- Automatic external RFI/submittal/inspection submission.
- Creating hundreds of low-confidence checklist items.

The AI must phrase findings as possible compliance exposure or project requirement tracking items requiring human review.

## 6. Core Concept

The Compliance Register is a filtered, compliance-focused view of the Risk Register.

MVP should not create a separate table. It should use existing `issues` rows where one or more of these fields is meaningful:

- `compliance_impact`
- `required_artifact`
- `spec_section`
- `drawing_sheet`
- `evidence`
- `confidence`
- `responsible_party`
- `responsible_trade`
- `risk_category`
- `risk_tier`
- `risk_score`
- `human_reviewed_at`
- canonical workflow state

The product model:

- Every compliance item is also an issue/risk.
- Every item has evidence.
- Every item has a required action or artifact.
- Every item can move through the existing issue/RFI workflow.
- Every item can later link to submittals, inspections, approvals, and closeout records.

## 7. Compliance Item Types

The Compliance Register should group items by the action a PE needs to take.

Primary compliance groups:

- `rfi_needed`: A question must be clarified before work proceeds.
- `submittal_required`: Spec requires a submittal, product data, sample, shop drawing, mockup, certificate, or similar.
- `inspection_or_testing_required`: Spec or drawing requires inspection, testing, report, certificate, commissioning, or verification.
- `owner_approval_required`: Owner, architect, engineer, AHJ, or design-team approval is required.
- `possible_spec_deviation`: Drawing, submitted requirement, or planned work may conflict with a spec requirement.
- `closeout_required`: Warranty, O&M, attic stock, training, as-built, certificate, turnover, or closeout item is required.

Mapping to existing fields:

- `required_artifact = rfi` -> `rfi_needed`
- `required_artifact = submittal` -> `submittal_required`
- `required_artifact = test_report` or `inspection` -> `inspection_or_testing_required`
- `required_artifact = owner_approval` -> `owner_approval_required`
- `required_artifact = closeout_document` -> `closeout_required`
- `compliance_impact = spec_deviation` -> `possible_spec_deviation`

If multiple groups apply, the UI should show one primary group based on `required_artifact`, with compliance impact as supporting context.

## 8. Required Fields

Every Compliance Register item should show:

- Summary.
- Compliance impact.
- Required artifact.
- Spec section, if known.
- Drawing sheet, if known.
- Evidence references.
- Confidence.
- Responsible party.
- Responsible trade.
- Workflow state.
- Recommended action.

Good item examples:

- “Section 07 84 00 requires firestopping product data and installer qualifications; no submittal item is currently tracked.”
- “A601 door schedule omits fire rating for Door 101 while Section 08 11 13 requires rated openings.”
- “Section 01 45 00 requires third-party testing for concrete strength; inspection/testing artifact should be tracked.”
- “Millwork finish selection requires owner approval before release.”

Bad item examples:

- “This building may violate code.”
- “Check all doors.”
- “Submittal maybe required.”
- “Coordinate with architect.”

Bad items are too vague, lack evidence, or imply a legal/code conclusion.

## 9. Agent Behavior

Add a compliance-focused scan mode that reuses the risk agent architecture.

Agent mode:

- `compliance_register_scan`

Inputs:

- Project id.
- Optional document filters.
- Optional spec section filter.
- Optional trade filter.
- Optional artifact filter.

Retrieval strategy:

- Prioritize specifications, drawing notes/schedules, addenda, RFI answers, and submittal review comments.
- Retrieve requirement-like chunks from specs.
- Retrieve related drawing sheets, schedules, and notes.
- Compare requirement language against drawing/schedule references when available.
- Prefer fewer, stronger compliance items over broad checklist spam.

Output per finding:

- Summary.
- Description.
- Compliance impact.
- Required artifact.
- Responsible party.
- Responsible trade.
- Spec section.
- Drawing sheet.
- Evidence citations.
- Confidence.
- Evidence strength.
- Recommended action.
- Draft RFI if required artifact is `rfi`.

Guardrails:

- Do not create findings without citations.
- Do not claim definitive code violation.
- Use “possible,” “appears,” or “requires human review” for compliance exposure.
- Do not invent spec sections, drawing sheets, responsible party, or approval authority.
- Cap MVP scan output to 10 created findings.
- If a similar open item exists, skip it or link/update later.

## 10. Scoring and Priority

Compliance items should rank by practical PE urgency, not legal severity.

Priority inputs:

- `compliance_impact`
- `required_artifact`
- `risk_tier`
- `risk_score`
- `confidence`
- `evidence_strength`
- blocked activity
- workflow state

Ranking rules:

- `code_or_life_safety` ranks highest.
- `inspection_or_testing_required` ranks high if it can block field work or acceptance.
- `submittal_required` ranks high when tied to procurement or long-lead release.
- `owner_approval_required` ranks high when it blocks design decision, material release, or change approval.
- low-confidence findings should remain visible but below high-confidence, high-impact findings.

UI should show priority as a tier:

- Critical
- High
- Medium
- Low

The UI may expose numeric risk score only in exports, not as the primary user-facing control.

## 11. User Workflow

Primary workflow:

1. PE uploads drawings/specs/addenda/submittals.
2. PE opens Risk Register or Compliance Register.
3. PE runs Compliance Scan.
4. System creates evidence-backed compliance items.
5. PE reviews each item:
   - accept as issue,
   - assign responsible party/trade,
   - convert to RFI,
   - mark submittal needed,
   - mark inspection/testing needed,
   - mark owner approval needed,
   - dismiss as not relevant,
   - resolve once complete.
6. Accepted items remain in the existing issue workflow.
7. Export or copy the register for OAC, coordination meetings, or manual upload to Procore/Autodesk.

Secondary workflows:

- Filter by spec section before a submittal log meeting.
- Filter by responsible trade before a subcontractor coordination meeting.
- Filter by inspection/testing before a field readiness meeting.
- Filter by owner approvals before OAC.
- Filter by unresolved high-confidence items before procurement release.

## 12. UI Requirements

MVP navigation options:

- Preferred: add a Compliance view inside the existing Risks tab.
- Later: promote to its own `Compliance` project tab when the workflow becomes large enough.

Risk Register additions:

- Add Compliance view toggle or tab:
  - `All Risks`
  - `Compliance`
  - `RFIs Needed`
  - `Submittals`
  - `Inspections/Testing`
  - `Owner Approvals`
  - `Closeout`

Compliance summary cards:

- Open compliance items.
- High-impact compliance exposure.
- RFIs needed.
- Submittals required.
- Inspection/testing required.
- Owner approvals required.
- Items awaiting human review.

Filters:

- Compliance impact.
- Required artifact.
- Spec section.
- Drawing sheet.
- Responsible party.
- Responsible trade.
- Confidence.
- Workflow state.
- Human reviewed / awaiting review.

Compliance item card:

- Priority tier.
- Summary.
- Required artifact badge.
- Compliance impact badge.
- Spec section / drawing sheet.
- Responsible party/trade.
- Confidence.
- Workflow state.
- Evidence count.
- Recommended action.

Detail drawer/page:

- Description.
- Requirement evidence.
- Drawing/spec references.
- Recommended action.
- Draft RFI if present.
- Editable metadata.
- Workflow editor.
- Source viewer.

## 13. API Requirements

MVP should reuse existing endpoints where possible.

Existing endpoint extensions:

- `GET /api/projects/:projectId/risks`
  - Add filters for `compliance_impact`, `required_artifact`, `spec_section`, `drawing_sheet`, `responsible_party`, and `responsible_trade`.
  - Support a `view=compliance` query that returns items where `compliance_impact != none` or `required_artifact != none`.

- `PATCH /api/projects/:projectId/issues/:issueId`
  - Continue using canonical workflow mutation.
  - Continue using the risk metadata wrapper RPC for atomic workflow + compliance metadata edits.

New endpoint:

- `POST /api/projects/:projectId/agents/compliance-scan`
  - Creates an `agent_runs` row.
  - Runs `compliance_register_scan`.
  - Persists findings as issue rows with risk/compliance metadata.
  - Returns agent run id and status.

API response for compliance scan:

- Agent run id.
- Status.
- Created item count.
- Skipped duplicate count.
- Error summary.

## 14. Data Model

MVP should use current issue fields:

- `risk_category`
- `risk_score`
- `risk_tier`
- `cost_impact`
- `schedule_impact`
- `compliance_impact`
- `responsible_party`
- `responsible_trade`
- `spec_section`
- `drawing_sheet`
- `required_artifact`
- `blocked_activity`
- `risk_reasoning`
- `evidence_strength`
- `human_reviewed_at`
- `human_reviewed_by`

No new table is required for the MVP.

Future table:

- `compliance_requirements`

Use this only when the product needs requirement-level lifecycle tracking independent of issues. Example future fields:

- source document id,
- spec section,
- requirement text,
- responsible trade,
- required artifact,
- linked issue id,
- linked submittal id,
- linked inspection id,
- closeout status.

The first version should not add this table because it would slow the demo and force premature requirement-matrix design.

## 15. Exports and Reporting

MVP exports:

- Compliance Register CSV.
- Copy selected compliance item.
- Copy draft RFI packet when required artifact is `rfi`.

CSV columns:

- Priority.
- Summary.
- Compliance impact.
- Required artifact.
- Spec section.
- Drawing sheet.
- Responsible party.
- Responsible trade.
- Confidence.
- Workflow state.
- Recommended action.
- Evidence references.

Future reports:

- PDF compliance exposure report for OAC.
- Submittal requirements export.
- Inspection/testing readiness report.
- Closeout requirements report.
- Procore/Autodesk-ready import payload.

## 16. Integration Strategy

Do not start with direct platform writeback.

MVP integration path:

1. CSV export.
2. Copy/paste packets for RFIs and compliance items.
3. External URL fields back to Procore, Autodesk Build, Bluebeam, SharePoint, or email.
4. Pilot-driven connector for the customer’s source of truth.

Customer discovery questions:

- Where do you track submittals?
- Where do you track inspections/testing?
- Where do owner approvals live?
- Do you already maintain a compliance matrix?
- Which exports would save your PE the most time this week?
- Who can approve API access if manual export is not enough?

## 17. Acceptance Criteria

Product:

- PE can open a Compliance view from the Risk Register.
- PE can run a Compliance Scan.
- System creates evidence-backed compliance items.
- Each item shows compliance impact, required artifact, spec section/drawing sheet if available, evidence, confidence, and responsible party/trade.
- PE can filter by required artifact, compliance impact, spec section, responsible trade, and workflow state.
- PE can open source evidence.
- PE can update metadata without breaking workflow invariants.
- PE can export the Compliance Register as CSV.

Agent:

- Agent does not create compliance items without evidence.
- Agent does not claim definitive code compliance.
- Agent caps findings to avoid noise.
- Agent outputs draft RFI only when `required_artifact = rfi`.

Engineering:

- No parallel compliance workflow state.
- No separate compliance table for MVP.
- Existing issue workflow RPC remains canonical.
- Risk metadata validation remains shared.
- Unit tests cover compliance filtering, summary counts, CSV export, and prompt taxonomy.
- `npm test`, `npm run lint`, and `npm run build` pass.

## 18. Recommended MVP Slice

Build this in four implementation phases:

1. Compliance summary and filtering over existing risk metadata.
2. Compliance Register UI view inside the Risks page.
3. Compliance Scan agent mode using the existing risk scan architecture.
4. Compliance CSV export and copy packet.

This creates a demoable “AI Risk + Compliance Register” without inventing a second product surface or premature integrations.

## 19. Open Questions for Pilot Discovery

These should not block the MVP:

- Do PEs think in required artifacts, spec sections, trades, or responsible parties first?
- Is “Compliance Register” the right name, or should it be “Requirements Register” for less legal baggage?
- Should submittal requirements become real submittal records immediately, or stay as compliance items until human acceptance?
- Which compliance groups matter most in the first vertical: submittals, inspections/testing, owner approvals, or closeout?
- What export format gets the fastest pilot adoption?
