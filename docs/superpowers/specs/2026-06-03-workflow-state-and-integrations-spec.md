# Workflow State and Integrations Spec

Date: 2026-06-03
Status: Draft for founder/engineering review
Context: RFI Copilot MVP for construction teams that upload project documents, find issues, draft RFIs, and track open items.

## 1. Why This Spec Exists

The product should feel like one workflow to the user:

> Found issue -> review it -> draft RFI -> approve -> submit externally -> track answer -> resolve.

Internally, the database has both `issues` and `rfis`. That is useful for reporting and future integrations, but it can confuse the UI and API if both objects expose separate editable statuses. The system needs one canonical workflow state, with all lower-level statuses derived from it.

The product also needs a clear integration strategy. We should not try to integrate with every construction platform at once. The startup wedge is to be useful before integrations, then add connectors based on pilot customer demand.

## 2. Goals

- Use one workflow state across UI, API, and database RPCs.
- Keep `issues.status` and `rfis.status` as derived implementation details.
- Reject invalid workflow transitions at the SQL boundary.
- Make manual export/copy useful before direct integrations exist.
- Define a connector strategy for Procore, Autodesk Build, Bluebeam, SharePoint/OneDrive, email, and CSV/manual imports.
- Give sales/pilot conversations a simple answer to: "Do we need their API?"

## 3. Non-Goals

- Build every connector in the MVP.
- Automate external RFI submission without human approval.
- Replace Procore, Autodesk, SharePoint, or email as the customer's source of truth on day one.
- Guarantee exact vendor API behavior in this spec. Vendor API details must be verified against official docs during implementation.

## 4. Canonical Workflow State

### 4.1 State List

The canonical issue workflow states are:

- `open`
- `acknowledged`
- `draft_rfi`
- `needs_edit`
- `approved`
- `submitted`
- `answered`
- `resolved`
- `dismissed`

These states are user-facing enough to power the UI and precise enough to drive database invariants.

### 4.2 Meaning

`open`
: The AI or a user found a potential issue. No RFI decision has been made.

`acknowledged`
: A human has seen the issue and agrees it needs review, but no RFI draft is ready.

`draft_rfi`
: A draft RFI exists or should exist. It is not approved for external submission.

`needs_edit`
: A reviewer looked at the draft and wants edits before approval.

`approved`
: The draft RFI is approved for external submission, but has not been marked submitted.

`submitted`
: The RFI was submitted outside this product, or a future connector has submitted it.

`answered`
: The external RFI has an answer or response attached.

`resolved`
: The issue is fully closed out in this product.

`dismissed`
: The issue is not worth pursuing.

## 5. Derived Status Mapping

The UI and API should send `workflow_state`. The SQL RPC should derive `issues.status` and `rfis.status`.

| Workflow state | `issues.status` | `rfis.status` |
| --- | --- | --- |
| `open` | `open` | `draft` |
| `acknowledged` | `acknowledged` | `draft` |
| `draft_rfi` | `draft_rfi` | `draft` |
| `needs_edit` | `draft_rfi` | `needs_edit` |
| `approved` | `draft_rfi` | `approved` |
| `submitted` | `submitted` | `submitted_externally` |
| `answered` | `answered` | `answered` |
| `resolved` | `resolved` | `closed` |
| `dismissed` | `dismissed` | `closed` |

Important invariant:

> No client should be able to set an issue/RFI status combination that contradicts `workflow_state`.

If the client sends `status` or `rfi_status` for backward compatibility, the RPC must validate that those values match the derived mapping above. If they do not match, the RPC rejects the write.

## 6. Valid Transitions

Allowed transitions:

| Current | Allowed next states |
| --- | --- |
| `open` | `acknowledged`, `draft_rfi`, `resolved`, `dismissed` |
| `acknowledged` | `draft_rfi`, `resolved`, `dismissed` |
| `draft_rfi` | `needs_edit`, `approved`, `submitted`, `resolved`, `dismissed` |
| `needs_edit` | `draft_rfi`, `approved`, `resolved`, `dismissed` |
| `approved` | `needs_edit`, `submitted`, `resolved`, `dismissed` |
| `submitted` | `answered`, `resolved` |
| `answered` | `resolved` |
| `resolved` | `open` |
| `dismissed` | `open` |

Same-state updates are allowed so users can edit metadata, draft text, due date, trade, external URL, response, or resolution notes without changing workflow state.

## 7. UI Requirements

### 7.1 Issue Detail

The issue workflow editor should show one status control labeled as the issue/RFI workflow state. It should not show a separate issue status dropdown and RFI status dropdown.

Required fields:

- Workflow state
- Trade
- Discipline
- Due date
- External system URL
- External RFI number
- External RFI URL
- Draft RFI question
- Response
- Resolution notes

UI behavior:

- Only valid next workflow states should be selectable.
- The UI can allow same-state edits.
- When the user moves to `submitted`, the UI should nudge them to enter an external RFI number or external URL, but should not require it for MVP manual workflows.
- When the user moves to `answered`, the UI should expose the response field prominently.
- When the user moves to `resolved`, the UI should expose resolution notes prominently.

### 7.2 Dashboard

Dashboard counts should use canonical workflow states:

- Open issues: `open`, `acknowledged`
- Draft RFIs: `draft_rfi`, `needs_edit`, `approved`
- Submitted RFIs: `submitted`
- Answered awaiting closeout: `answered`
- Closed: `resolved`, `dismissed`

### 7.3 Copy and Export

Before API integrations exist, the product must still help the user move fast:

- Copy draft RFI subject/question/evidence to clipboard.
- Export draft RFI as text/PDF.
- Store external RFI number.
- Store external URL back to Procore, Autodesk Build, email thread, or SharePoint item.

Manual mode is not a hack. It is the MVP bridge that lets customers use the product without platform approval cycles.

## 8. API Requirements

### 8.1 Patch Issue Workflow

The API should accept `workflow_state` as the canonical status input.

Allowed patch fields:

- `workflow_state`
- `trade`
- `discipline`
- `due_date`
- `external_system_url`
- `external_rfi_number`
- `external_url`
- `response`
- `resolution_notes`
- `draft_rfi`

Backward-compatible fields:

- `status`
- `rfi_status`

If backward-compatible fields are present, they must match the status values derived from `workflow_state`.

### 8.2 API Responsibilities

The API should:

- Authenticate the user.
- Confirm project access.
- Derive current workflow state from the current issue/RFI records.
- Validate requested transition before calling the RPC.
- Send the patch to the SQL RPC.
- Return the updated issue plus linked RFI.

The API should not:

- Trust client-provided `status` or `rfi_status` as independent truth.
- Encode different transition rules than the shared workflow helper.
- Allow direct client writes to `issues.status` or `rfis.status`.

## 9. SQL RPC Requirements

The SQL RPC is the final enforcement layer.

It must:

- Lock the target issue row.
- Lock the linked RFI row if one exists.
- Derive the current workflow state from stored issue/RFI statuses.
- Validate the requested workflow state is known.
- Validate the transition is allowed.
- Derive `issues.status` and `rfis.status`.
- Reject contradictory `status` or `rfi_status` payload fields.
- Create an RFI row when the workflow enters an RFI-related state or RFI metadata is edited.
- Preserve `submitted_at` when already set.
- Preserve `answered_at` when already set.
- Set `submitted_at` on first transition to `submitted`.
- Set `answered_at` on first transition to `answered`.

The RPC should be the only supported mutation path for issue workflow changes.

## 10. Integration Strategy

### 10.1 The Short Answer

We do not ask every platform for an API on day one.

The practical startup path is:

1. Build useful manual workflows first.
2. Ask pilot customers what their source of truth is.
3. Ask that customer for sandbox/API/OAuth access to the one system they already use.
4. Build one connector behind a reusable internal connector interface.
5. Repeat only when customer demand proves the next connector matters.

### 10.2 What To Ask Customers

In every pilot/customer discovery call, ask:

- What system is your source of truth for RFIs?
- What system is your source of truth for submittals?
- Where do plans/specs live before they reach the field?
- Do you use Procore, Autodesk Build, Bluebeam, SharePoint/OneDrive, email, or something else?
- Who is the admin who can approve API/OAuth access?
- Can you provide a sandbox project or test project?
- Do you need import only, export only, or two-way sync?
- Which fields/statuses must match your current process?
- What would make manual copy/export acceptable for a first pilot?

This keeps integrations customer-led instead of roadmap-led.

### 10.3 Connector Rollout Order

Recommended order:

1. Manual mode: copy/export draft RFI, store external number and URL.
2. Email integration: ingest RFI responses and forwarded project correspondence.
3. Procore connector: likely first formal RFI/submittal system for many GCs.
4. Autodesk Build connector: second major project-management platform.
5. SharePoint/OneDrive connector: common document source for plans/specs.
6. Bluebeam-oriented workflow: import drawings/sessions or link to review artifacts where customer process demands it.
7. CSV/import-export fallback: useful for smaller customers and migration workflows.

The first paid pilots should decide whether Procore or Autodesk comes first.

## 11. Integration Product Modes

### 11.1 Manual Mode

No external API required.

Capabilities:

- Copy RFI draft.
- Export PDF/text.
- Paste external URL after user creates RFI in source system.
- Paste external RFI number.
- Mark `submitted`, `answered`, and `resolved` manually.

This should be good enough for the first pilots.

### 11.2 Import-Only Mode

External API or document access may be required.

Capabilities:

- Pull plans/specs/RFIs/submittals from external system.
- Preserve external IDs.
- Link external records to internal issues/RFIs.
- Never write back externally.

This is easier to approve with cautious customers because the product is not mutating their source of truth.

### 11.3 Export/Writeback Mode

External API, OAuth scopes, customer admin approval, and stronger audit controls are required.

Capabilities:

- Push approved draft RFI to external system.
- Store external RFI number/URL.
- Sync external answer back.
- Keep workflow state aligned.

Writeback must always require human approval.

### 11.4 Two-Way Sync Mode

External API plus webhooks or scheduled polling are required.

Capabilities:

- Import external records.
- Push approved updates.
- Detect external status changes.
- Record sync conflicts.
- Preserve source-of-truth rules.

This should come after a successful import/writeback connector.

## 12. Internal Connector Contract

Every connector should map external systems into the same internal concepts:

- External organization/account
- External project
- External document
- External RFI
- External submittal
- External user/contact
- External URL

Minimum connector operations:

- `connect_account`
- `list_projects`
- `map_project`
- `import_documents`
- `import_rfis`
- `export_rfi`
- `sync_rfi_status`
- `disconnect_account`

Not every connector needs to implement every operation immediately. Unsupported operations should be explicit.

## 13. Integration Data Model

Future tables should support:

`external_connections`
: Stores provider, account metadata, connection status, token reference, created by, and last sync state.

`external_project_mappings`
: Maps internal project IDs to external project IDs.

`external_record_links`
: Maps internal `documents`, `issues`, `rfis`, and `submittals` to external provider records.

`integration_sync_runs`
: Tracks sync start/end, status, errors, counts, and provider.

`integration_sync_events`
: Stores per-record import/export results and conflicts.

Secrets and OAuth tokens should not be stored as plain text application rows. They should be stored using the deployment platform's secret/token storage approach.

## 14. Integration Invariants

- Internal workflow state remains canonical inside this app.
- External systems remain source of truth only for records explicitly linked to them.
- A connector may move internal workflow from `submitted` to `answered` when an external answer is detected.
- A connector may not move an issue to `resolved` without a user action.
- A connector may not submit an RFI externally unless internal workflow is `approved` or the user explicitly confirms submission.
- Every external write must create an audit event.
- Every imported external record must be idempotent by provider and external ID.
- Sync errors must be visible to users, not hidden in logs only.
- Manual mode must keep working even when a connector is disconnected.

## 15. MVP Acceptance Criteria

Workflow state:

- User can edit an issue workflow from the UI with a single workflow state control.
- API accepts `workflow_state` and persists derived issue/RFI statuses.
- SQL RPC rejects invalid transitions.
- SQL RPC rejects contradictory `status` or `rfi_status` fields.
- Dashboard counts use canonical states.

Manual integrations:

- User can copy/export a draft RFI.
- User can store external RFI number and external URL.
- User can mark an RFI submitted after creating it externally.
- User can paste the external answer and mark it answered.
- User can resolve the issue with resolution notes.

Connector readiness:

- Product has a documented connector contract.
- First pilot discovery identifies the customer's source-of-truth system.
- First formal connector is selected from customer demand, not guessed in advance.

## 16. Founder Guidance

When a customer asks "Do you integrate with Procore/Autodesk/Bluebeam?", the honest answer is:

> We can support the workflow today with copy/export and external links. For pilots, we identify your source-of-truth system and add the connector that matters first. We do not need to replace your system to save your project engineers hours immediately.

That is the right startup answer. It sells value now, avoids months of partner/API work before validation, and still gives enterprise customers a believable integration path.
