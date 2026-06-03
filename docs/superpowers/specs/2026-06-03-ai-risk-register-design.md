# AI Risk Register Design

Date: 2026-06-03
Status: Draft for founder review
Context: AI Project Engineer for GC project engineers. The current app supports project document upload, processing, chat, RFI issue detection, source evidence viewing, issue workflow, RFI drafting, manual export, and submittal review.

## 1. Goal

Build an AI Risk Register that turns uploaded drawings, specs, addenda, RFIs, and submittals into a ranked project issue log for GC project engineers.

The product promise:

> Upload the project documents. Get a ranked risk register with cost risk, schedule risk, compliance exposure, responsible trade, confidence, evidence, and draft next actions.

This should feel bigger than an RFI scanner. It should be the first version of an AI project controls layer: find risks, explain them with citations, route them into RFIs/submittals/owner approvals, and preserve an audit trail.

## 2. Target User

Primary user:

- GC project engineer.

Supporting users:

- Assistant PM.
- Project manager.
- Superintendent.
- Construction technology or operations leader evaluating pilots.

The GC project engineer is the wedge because they own the daily workflow around document review, RFIs, submittals, design-team coordination, and issue closeout. They are close enough to the documents to trust or reject AI findings, but senior enough that their work affects cost, schedule, and compliance outcomes.

## 3. Problem

Project engineers are expected to catch document problems before they become field delays, change orders, rework, or failed reviews. The risk is distributed across many places:

- Drawings and drawing schedules.
- Project specifications.
- Addenda and revisions.
- Existing RFIs and answers.
- Submittals and review comments.
- Meeting notes or uploaded correspondence in later phases.

Existing construction systems store records, but they do not continuously reason across the document set. A PE still has to manually answer:

- What are the highest-risk unresolved issues?
- Which trade owns each issue?
- Does this create a likely RFI?
- Does this affect submittals or approvals?
- Is there a possible spec deviation or compliance exposure?
- What evidence supports the finding?
- What should I do next?

## 4. Product Positioning

Near-term positioning:

> AI risk register for construction documents.

Stronger demo positioning:

> Upload plans and specs. Get a ranked list of cost, schedule, and compliance risks with citations and draft RFIs.

Long-term positioning:

> AI compliance and risk control for construction projects.

The Risk Register is the wedge. Compliance is the expansion path. The system should capture compliance-related metadata from day one so the product can grow into a compliance matrix without rebuilding the issue model.

## 5. Non-Goals

This feature should not try to solve every compliance workflow in the first slice.

Out of scope:

- Legal/code compliance guarantees.
- Full building-code interpretation without project evidence.
- Automated external RFI submission.
- Direct Procore/Autodesk writeback.
- Full spec requirement matrix extraction for every section.
- Insurance-grade risk scoring.
- Replacing the PM or PE approval process.
- Bulk automatic creation of dozens of noisy issues.

The AI must assist human review. It should never claim authoritative compliance approval.

## 6. Core Concept

The AI Risk Register is a project-level list of evidence-backed risk items.

Each risk item answers:

- What is the risk?
- Why does it matter?
- What is the likely cost impact?
- What is the likely schedule impact?
- What is the compliance impact?
- Which trade or party probably owns it?
- What documents support it?
- How confident is the system?
- What should the PE do next?

Risk items should use the existing issue workflow backbone where possible. The product already has `issues`, linked `rfis`, canonical workflow states, evidence, source viewer, and draft RFI export. The Risk Register should extend that foundation with risk-specific and compliance-specific metadata instead of creating a parallel workflow.

## 7. Risk Types

The first version should classify risk items into a small set of clear categories.

Risk categories:

- `drawing_spec_conflict`: Drawing and specification appear inconsistent.
- `missing_information`: Required detail, dimension, product, location, or decision is missing.
- `coordination_conflict`: Two disciplines/trades conflict or require coordination.
- `submittal_requirement`: A spec requirement likely requires submittal tracking or review.
- `possible_spec_deviation`: Submitted or drawn requirement appears to deviate from spec.
- `owner_design_approval`: Requires owner, architect, engineer, or AHJ/design-team approval.
- `schedule_constraint`: Long-lead, sequencing, phasing, or approval timing risk.
- `cost_exposure`: Likely cost impact, scope gap, allowance ambiguity, or change-order exposure.
- `closeout_risk`: Warranty, O&M, as-built, testing, certificate, or turnover requirement risk.
- `other`: Evidence-backed risk that does not fit another category.

Do not overclassify. The AI can assign one primary category and optional secondary tags.

## 8. Compliance Hooks

Every risk item should include a compliance impact field even if the initial UI emphasizes cost and schedule.

Compliance impact values:

- `none`: No obvious compliance implication.
- `possible_noncompliance`: May violate project requirements, but evidence is incomplete.
- `spec_deviation`: Appears to conflict with a specification requirement.
- `code_or_life_safety`: Might involve code, fire/life safety, accessibility, egress, structural, MEP safety, or other high-stakes requirements.
- `submittal_required`: Spec appears to require a submittal, sample, mockup, test, or certification.
- `owner_approval_required`: Requires owner/design-team approval before proceeding.
- `inspection_or_testing_required`: Requires inspection, test, report, certificate, or verification.
- `closeout_required`: Creates a warranty, O&M, attic stock, as-built, training, certificate, or turnover requirement.

Compliance fields:

- Compliance impact.
- Governing document type: spec, drawing, addendum, RFI answer, submittal, other.
- Spec section, if known.
- Drawing sheet, if known.
- Requirement excerpt.
- Required artifact: submittal, test report, RFI, owner approval, inspection, closeout document, none.
- Compliance confidence.
- Human-reviewed flag.

This is what lets the Risk Register grow into:

- Compliance matrix.
- Submittal compliance review.
- Closeout checklist.
- Audit-ready issue trail.

## 9. Risk Scoring

The risk register should rank findings by a simple, explainable score.

Inputs:

- Cost impact.
- Schedule impact.
- Compliance impact.
- Severity.
- Confidence.
- Evidence strength.
- Urgency or due date.
- Whether the issue blocks work, procurement, approval, inspection, or closeout.

Impact scale:

- `none`
- `low`
- `medium`
- `high`
- `critical`

Score guidance:

- Critical compliance or life-safety exposure should rank high even if cost is unknown.
- High schedule impact should rank high when the item blocks procurement, long-lead release, inspection, or field work.
- Low-confidence findings should not outrank high-confidence findings unless the potential severity is critical.
- Findings with no evidence should not be created.

MVP scoring can be deterministic:

- Convert cost, schedule, compliance, and severity to points.
- Add evidence strength and confidence modifiers.
- Store a numeric `risk_score` for sorting.
- Show the score as a tier, not a mysterious number.

Risk tiers:

- Critical
- High
- Medium
- Low

## 10. Data Model

The implementation should extend existing issue records rather than create a separate unrelated table for MVP.

Recommended new fields on `issues`:

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

The existing fields remain useful:

- `issue_type`
- `severity`
- `status`
- `summary`
- `description`
- `evidence`
- `draft_rfi`
- `trade`
- `discipline`
- `due_date`
- `confidence`
- `recommended_action`
- `resolution_notes`
- `external_system_url`

Optional future table:

- `issue_risk_assessments`

Use a future assessment table only when the product needs history of changing risk scores across document revisions. MVP can keep current risk metadata on `issues`.

## 11. Agent Behavior

Add a Risk Register scan mode that uses processed project documents.

Inputs:

- Project id.
- Optional document filters.
- Optional trade or discipline.
- Optional scan type:
  - `quick_risk_scan`
  - `deep_risk_scan`
  - `compliance_exposure_scan`
  - `submittal_risk_scan`

Retrieval strategy:

- Use project-scoped chunks and page metadata.
- Prioritize specs, drawings, addenda, and linked submittals.
- Retrieve candidate requirements and related drawing/schedule references.
- Compare requirements across documents before generating a risk.
- Prefer fewer, stronger findings over broad issue spam.

Output per finding:

- Summary.
- Description.
- Risk category.
- Cost impact.
- Schedule impact.
- Compliance impact.
- Risk tier.
- Responsible party/trade.
- Spec section or drawing sheet, if known.
- Required artifact.
- Evidence citations.
- Confidence.
- Evidence strength.
- Recommended action.
- Draft RFI question when appropriate.

Guardrails:

- Do not create a risk without citations.
- Do not cite documents that were not retrieved.
- Do not claim code violation unless the project documents support the issue.
- If the finding is speculative, label it as possible and lower confidence.
- Cap MVP runs to a small number of created findings, such as 5 to 10.
- If a similar open issue exists, update or link instead of duplicating when feasible.

## 12. User Workflow

Primary workflow:

1. PE uploads drawings/specs/addenda/submittals.
2. Documents process into searchable pages/chunks.
3. PE opens the Risks tab.
4. PE runs an AI Risk Scan.
5. System creates a ranked list of evidence-backed risk items.
6. PE reviews each item:
   - Accept and assign.
   - Convert to RFI workflow.
   - Mark as compliance item.
   - Dismiss as not relevant.
   - Edit metadata.
7. PE tracks accepted items through the existing issue/RFI workflow.
8. Resolved items retain evidence, decisions, and closeout notes.

Secondary workflow:

- PE filters risks by trade before a coordination meeting.
- PE filters by compliance impact before submittal review.
- PM filters by high cost or schedule impact before an OAC meeting.
- Superintendent filters by blocked field activity.

## 13. UI Requirements

Add a new project tab:

- Risks: `/projects/:projectId/risks`

Risk Register page:

- Header summary:
  - Total open risks.
  - Critical/high risks.
  - Compliance exposure count.
  - Draft RFIs needed.
  - Risks awaiting human review.
- Primary action:
  - Run Risk Scan.
- Filters:
  - Risk tier.
  - Trade.
  - Responsible party.
  - Compliance impact.
  - Required artifact.
  - Workflow state.
  - Confidence.
- Sort:
  - Risk score.
  - Due date.
  - Created date.
  - Confidence.

Risk table/card fields:

- Risk tier.
- Summary.
- Cost impact.
- Schedule impact.
- Compliance impact.
- Trade/responsible party.
- Confidence.
- Evidence count.
- Workflow state.
- Recommended action.

Risk detail:

- Description and reasoning.
- Evidence with source viewer.
- Cost/schedule/compliance assessment.
- Required artifact.
- Draft RFI question, if present.
- Workflow editor.
- Resolution notes.

Dashboard changes:

- Add a Top Risks module.
- Add Compliance Exposure count.
- Add Risks Needing Review count.

## 14. API Requirements

New endpoints:

- `GET /api/projects/:projectId/risks`
- `POST /api/projects/:projectId/agents/risk-scan`

Optional endpoint if the existing issue patch API becomes too broad:

- `PATCH /api/projects/:projectId/risks/:issueId`

API behavior:

- Authenticate user.
- Confirm project access.
- Return only project-scoped issues.
- Use existing issue workflow mutation for workflow transitions.
- Validate risk metadata fields.
- Persist agent runs for risk scans.

Risk scan response:

- Agent run id.
- Created/updated risk count.
- Skipped duplicate count.
- Summary of highest risks.

## 15. Reporting and Exports

MVP exports:

- Copy risk summary.
- Export risk register as CSV.
- Export selected risk as RFI packet text.

Future exports:

- PDF risk report for OAC meetings.
- Compliance matrix export.
- Procore/Autodesk-ready payload.
- Owner/design-team issue packet.

CSV columns:

- Risk tier.
- Summary.
- Risk category.
- Cost impact.
- Schedule impact.
- Compliance impact.
- Trade.
- Responsible party.
- Spec section.
- Drawing sheet.
- Required artifact.
- Confidence.
- Workflow state.
- Recommended action.
- Evidence references.

## 16. Compliance Expansion Path

The Risk Register should lead into compliance in three phases.

Phase 1: Compliance hooks in risk items.

- Store compliance impact.
- Store governing spec/drawing references.
- Store required artifact.
- Store evidence and human review status.

Phase 2: Compliance matrix.

- Extract requirements by spec section.
- Map each requirement to responsible trade and required artifact.
- Link risks, submittals, RFIs, inspections, and closeout records back to requirements.

Phase 3: Audit trail and closeout.

- Track each requirement from source document to submittal/RFI/approval/inspection/closeout.
- Export audit-ready evidence packages.
- Show unresolved compliance exposure by trade and spec section.

The design should avoid painting the product into an RFI-only corner. Every risk should be able to connect to a future requirement row.

## 17. Acceptance Criteria

Product:

- GC project engineer can run a Risk Scan from a project.
- The product creates a ranked risk register with cited evidence.
- Each risk shows cost impact, schedule impact, compliance impact, trade, responsible party, confidence, and recommended action.
- User can filter risks by tier, trade, compliance impact, and workflow state.
- User can open source evidence from a risk item.
- User can convert an accepted risk into the existing RFI workflow.
- User can dismiss or resolve risk items.

Compliance:

- Risk items include compliance impact metadata.
- Risk items can identify submittal-required, owner-approval-required, inspection/testing-required, and closeout-required exposures.
- The spec section or drawing sheet is captured when available.

Quality:

- Agent does not create findings without evidence.
- Risk scan caps created findings to prevent noise.
- Existing issue workflow invariants remain enforced.
- Unit tests cover risk scoring helpers and risk summary counts.
- API validation tests cover risk metadata payloads.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

## 18. Open Product Questions

These do not block the first implementation plan, but they should be revisited during pilot discovery:

- Should risk scoring use dollars/days eventually, or remain tier-based for trust?
- Should responsible party be a free-text field first or tied to project members/companies?
- Should compliance impact be editable by humans before a finding is accepted?
- Which export matters first: CSV risk register, PDF report, or Procore-ready RFI packet?
- Should scan runs update previous risks when a revised drawing/addendum is uploaded?

## 19. Recommended MVP Slice

Build the smallest version that proves the company thesis:

1. Add risk metadata to issues.
2. Add shared risk scoring and summary helpers.
3. Add Risk Register page with filters and top-risk cards.
4. Add Risk Scan agent route using existing retrieval and evidence patterns.
5. Add dashboard Top Risks and Compliance Exposure modules.
6. Add CSV export for the risk register.

This slice should make the product feel like an AI project engineer, not just a document chatbot.
