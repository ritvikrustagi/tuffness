# RFI Copilot Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first product-spec slice by hardening the RFI issue lifecycle, adding editable/manual tracking for RFIs, and validating richer AI issue output.

**Architecture:** Keep the current Supabase + Next.js structure. Add one migration for workflow fields, one focused issue/RFI domain helper module, API handlers for updates, and a client-side issue review component that edits statuses and copies draft RFIs for external systems.

**Tech Stack:** Next.js App Router, React client components, Supabase route handlers, Zod, Vitest for focused domain tests.

---

## File Structure

- Create `supabase/migrations/006_rfi_workflow.sql`: database enum/table additions for the fuller RFI lifecycle.
- Modify `apps/web/lib/types/database.ts`: TypeScript types for new statuses and fields.
- Modify `apps/web/lib/agents/rfi/schema.ts`: richer validated agent output with `description`, `confidence`, `trade`, and `recommended_action`.
- Create `apps/web/lib/issues/workflow.ts`: pure helpers for status validation, draft RFI payloads, and evidence normalization.
- Create `apps/web/lib/issues/workflow.test.ts`: behavior tests for the helper module.
- Modify `apps/web/app/api/projects/[projectId]/issues/route.ts`: create/update issue workflow endpoints.
- Create `apps/web/app/api/projects/[projectId]/issues/[issueId]/route.ts`: update one issue and its linked draft RFI.
- Modify `apps/web/components/issues/issue-list.tsx`: replace static list with an interactive review workflow.
- Modify `apps/web/lib/agents/rfi/runner.ts`: persist richer agent output fields.
- Modify `apps/web/package.json`: add `test` script and Vitest dev dependency.

---

### Task 1: Add Test Harness

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add Vitest dependency and test script**

Update `apps/web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^4.0.14"
  }
}
```

- [ ] **Step 2: Install dependency**

Run: `npm install --workspace=web`

Expected: `package-lock.json` and `apps/web/package-lock.json` update with Vitest.

- [ ] **Step 3: Verify empty test command behavior**

Run: `npm run test --workspace=web -- --passWithNoTests`

Expected: command exits 0 before tests exist.

---

### Task 2: Write Failing Workflow Tests

**Files:**
- Create: `apps/web/lib/issues/workflow.test.ts`
- Create later: `apps/web/lib/issues/workflow.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/lib/issues/workflow.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildDraftRfiPatch,
  getAllowedIssueTransitions,
  normalizeIssueEvidence,
} from "@/lib/issues/workflow";

describe("RFI issue workflow", () => {
  test("allows draft RFI lifecycle statuses from an open issue", () => {
    expect(getAllowedIssueTransitions("open")).toEqual([
      "acknowledged",
      "draft_rfi",
      "resolved",
      "dismissed",
    ]);
  });

  test("builds a manual external submission patch", () => {
    expect(
      buildDraftRfiPatch({
        status: "submitted_externally",
        external_rfi_number: "RFI-042",
        external_url: "https://example.com/rfis/42",
      })
    ).toEqual({
      status: "submitted_externally",
      external_rfi_number: "RFI-042",
      external_url: "https://example.com/rfis/42",
      submitted_at: expect.any(String),
    });
  });

  test("normalizes agent evidence into quote-backed issue evidence", () => {
    expect(
      normalizeIssueEvidence([
        {
          document_id: "11111111-1111-4111-8111-111111111111",
          document_name: "A601 Door Schedule",
          page_number: 12,
          quote: "Door 101 hardware set is omitted.",
        },
      ])
    ).toEqual([
      {
        document_id: "11111111-1111-4111-8111-111111111111",
        document_name: "A601 Door Schedule",
        page_number: 12,
        excerpt: "Door 101 hardware set is omitted.",
        quote: "Door 101 hardware set is omitted.",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=web -- apps/web/lib/issues/workflow.test.ts`

Expected: FAIL because `@/lib/issues/workflow` does not exist.

---

### Task 3: Implement Workflow Helper

**Files:**
- Create: `apps/web/lib/issues/workflow.ts`
- Test: `apps/web/lib/issues/workflow.test.ts`

- [ ] **Step 1: Add minimal implementation**

Create `apps/web/lib/issues/workflow.ts`:

```ts
import type { IssueEvidence, IssueStatus, RfiStatus } from "@/lib/types/database";

export const issueStatuses = [
  "open",
  "acknowledged",
  "draft_rfi",
  "submitted",
  "answered",
  "resolved",
  "dismissed",
] as const satisfies readonly IssueStatus[];

export const rfiStatuses = [
  "draft",
  "needs_edit",
  "approved",
  "submitted_externally",
  "answered",
  "closed",
] as const satisfies readonly RfiStatus[];

const issueTransitions: Record<IssueStatus, IssueStatus[]> = {
  open: ["acknowledged", "draft_rfi", "resolved", "dismissed"],
  acknowledged: ["draft_rfi", "resolved", "dismissed"],
  draft_rfi: ["submitted", "resolved", "dismissed"],
  submitted: ["answered", "resolved"],
  answered: ["resolved"],
  resolved: ["open"],
  dismissed: ["open"],
};

export function getAllowedIssueTransitions(status: IssueStatus): IssueStatus[] {
  return issueTransitions[status] ?? [];
}

export function normalizeIssueEvidence(
  evidence: Array<{
    document_id: string;
    document_name: string;
    page_number: number;
    quote: string;
  }>
): IssueEvidence[] {
  return evidence.map((item) => ({
    document_id: item.document_id,
    document_name: item.document_name,
    page_number: item.page_number,
    excerpt: item.quote,
    quote: item.quote,
  }));
}

export function buildDraftRfiPatch(input: {
  status: RfiStatus;
  external_rfi_number?: string;
  external_url?: string;
  response?: string;
}) {
  const patch: Record<string, string | null> = {
    status: input.status,
  };

  if (input.external_rfi_number !== undefined) {
    patch.external_rfi_number = input.external_rfi_number || null;
  }

  if (input.external_url !== undefined) {
    patch.external_url = input.external_url || null;
  }

  if (input.response !== undefined) {
    patch.response = input.response || null;
  }

  if (input.status === "submitted_externally") {
    patch.submitted_at = new Date().toISOString();
  }

  if (input.status === "answered") {
    patch.answered_at = new Date().toISOString();
  }

  return patch;
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test --workspace=web -- apps/web/lib/issues/workflow.test.ts`

Expected: PASS.

---

### Task 4: Add Database Workflow Migration and Types

**Files:**
- Create: `supabase/migrations/006_rfi_workflow.sql`
- Modify: `apps/web/lib/types/database.ts`

- [ ] **Step 1: Add migration**

Create `supabase/migrations/006_rfi_workflow.sql`:

```sql
-- Phase 6: RFI copilot workflow hardening

ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'draft_rfi';
ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'answered';

ALTER TYPE rfi_status ADD VALUE IF NOT EXISTS 'needs_edit';
ALTER TYPE rfi_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE rfi_status ADD VALUE IF NOT EXISTS 'submitted_externally';

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trade TEXT,
  ADD COLUMN IF NOT EXISTS discipline TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS recommended_action TEXT,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS external_system_url TEXT;

ALTER TABLE public.rfis
  ADD COLUMN IF NOT EXISTS external_rfi_number TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS answer_source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issues_owner ON public.issues(project_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_issues_trade ON public.issues(project_id, trade);
CREATE INDEX IF NOT EXISTS idx_issues_due_date ON public.issues(project_id, due_date);
CREATE INDEX IF NOT EXISTS idx_rfis_external_number ON public.rfis(project_id, external_rfi_number);
```

- [ ] **Step 2: Update TypeScript types**

Update `IssueStatus`, `RfiStatus`, `Issue`, and `Rfi` in `apps/web/lib/types/database.ts` with the new enum values and fields.

- [ ] **Step 3: Run typecheck**

Run: `npm run build --workspace=web`

Expected: Build succeeds or exposes type errors to fix before continuing.

---

### Task 5: Persist Richer RFI Agent Findings

**Files:**
- Modify: `apps/web/lib/agents/rfi/schema.ts`
- Modify: `apps/web/lib/agents/rfi/analyze.ts`
- Modify: `apps/web/lib/agents/rfi/runner.ts`
- Test: `apps/web/lib/issues/workflow.test.ts`

- [ ] **Step 1: Update agent schema**

Add optional structured fields:

```ts
description: z.string().min(1).max(2000).optional(),
confidence: z.number().min(0).max(1).optional(),
trade: z.string().min(1).max(100).optional(),
recommended_action: z.string().min(1).max(1000).optional(),
```

- [ ] **Step 2: Update prompt JSON example**

Update `apps/web/lib/agents/rfi/analyze.ts` to request the new fields and keep all claims evidence-backed.

- [ ] **Step 3: Persist the fields**

In `apps/web/lib/agents/rfi/runner.ts`, use `normalizeIssueEvidence`, set `status: "draft_rfi"`, and persist `description`, `confidence`, `trade`, and `recommended_action`.

- [ ] **Step 4: Run focused tests and build**

Run:

```bash
npm run test --workspace=web -- apps/web/lib/issues/workflow.test.ts
npm run build --workspace=web
```

Expected: both pass.

---

### Task 6: Add Issue/RFI Update API

**Files:**
- Create: `apps/web/app/api/projects/[projectId]/issues/[issueId]/route.ts`
- Modify: `apps/web/app/api/projects/[projectId]/issues/route.ts`

- [ ] **Step 1: Add PATCH route**

Create a route that:

- Uses `requireProjectAccess(projectId)`.
- Validates issue belongs to project.
- Accepts `status`, `resolution_notes`, `trade`, `discipline`, `due_date`, `external_system_url`, `draft_rfi`, `rfi_status`, `external_rfi_number`, `external_url`, and `response`.
- Updates the issue.
- Updates or creates the linked draft RFI.
- Returns `{ issue }`.

- [ ] **Step 2: Add status filtering**

Extend the issue list `GET` route to accept `status`.

- [ ] **Step 3: Run build**

Run: `npm run build --workspace=web`

Expected: Build succeeds.

---

### Task 7: Make Issue List Interactive

**Files:**
- Modify: `apps/web/components/issues/issue-list.tsx`

- [ ] **Step 1: Convert to client component**

Add `"use client";`, local form state per issue, and `useRouter`.

- [ ] **Step 2: Add workflow controls**

For each issue, render:

- issue status select
- RFI status select
- trade input
- due date input
- external RFI number input
- external URL input
- resolution notes textarea
- editable draft RFI textarea
- Save button
- Copy draft RFI button

- [ ] **Step 3: Save via PATCH**

On save, call `/api/projects/${projectId}/issues/${issue.id}` and refresh on success.

- [ ] **Step 4: Update caller**

Change `ProjectIssuesPage` to pass `projectId` into `IssueList`.

- [ ] **Step 5: Run build**

Run: `npm run build --workspace=web`

Expected: Build succeeds.

---

## Self-Review

Spec coverage:

- PDF ingestion: left unchanged because this slice focuses on the RFI copilot workflow.
- Chat citations: left unchanged for the same reason.
- Draft RFI generation: covered by richer agent fields, normalized evidence, and editable draft RFI workflow.
- Issue tracker: covered by new statuses, ownership/trade/due-date fields, and update UI/API.
- Human approval/export: covered by manual statuses and copy/external tracking.

Placeholder scan:

- No `TBD` or `TODO` placeholders.
- Task 6 and Task 7 describe endpoint/UI behavior without full code blocks because the surrounding route/component implementation must fit existing code shape. The concrete acceptance checks are build and focused helper tests.

Type consistency:

- `draft_rfi`, `submitted_externally`, `external_rfi_number`, `external_url`, `submitted_at`, and `answered_at` are introduced in migration/types/helper/API/UI together.
