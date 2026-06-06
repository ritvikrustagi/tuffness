# Risk Detail Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a focused AI Risk + Compliance detail page with editable metadata, workflow controls, evidence review, compliance packet copy, and explicit human review.

**Architecture:** Reuse the existing issue PATCH API and workflow form. Add a small risk detail client component, a detail route, a review-aware risk RPC patch helper, and a Supabase migration that accepts `reviewed` as an explicit audit action.

**Tech Stack:** Next.js App Router, React client components, Supabase RPC, Zod, Vitest, Tailwind.

---

### Task 1: Review Patch Contract

**Files:**
- Modify: `apps/web/lib/risks/validation.ts`
- Modify: `apps/web/lib/risks/patch.ts`
- Test: `apps/web/lib/risks/validation.test.ts`
- Test: `apps/web/lib/risks/patch.test.ts`

- [ ] Add failing tests that `reviewed: true` is accepted, `reviewed: false` is rejected, and `buildRiskMetadataRpcPatch` emits `{ reviewed: true }`.
- [ ] Run `npm test --workspace=web -- lib/risks/validation.test.ts lib/risks/patch.test.ts` and confirm the new tests fail.
- [ ] Extend the risk metadata schema with `reviewed: z.literal(true).optional()` and include it in the RPC patch helper.
- [ ] Re-run the targeted tests and confirm they pass.

### Task 2: API And SQL Review Audit

**Files:**
- Modify: `apps/web/app/api/projects/[projectId]/issues/[issueId]/route.ts`
- Create: `supabase/migrations/012_explicit_risk_review_flag.sql`
- Test: `apps/web/lib/risks/types.test.ts`

- [ ] Add a migration replacing `save_issue_with_risk_metadata` so either risk metadata fields or `reviewed` can update `human_reviewed_at` and `human_reviewed_by`.
- [ ] Ensure the route treats `reviewed: true` as a valid risk patch and passes it to `save_issue_with_risk_metadata`.
- [ ] Update SQL text tests to include the new migration.

### Task 3: Detail Workspace UI

**Files:**
- Create: `apps/web/components/risks/risk-detail-workspace.tsx`
- Create: `apps/web/app/(dashboard)/projects/[projectId]/risks/[issueId]/page.tsx`
- Modify: `apps/web/components/risks/risk-card.tsx`

- [ ] Add a server detail route that fetches one risk issue for the project, returns 404 when missing, and renders the client workspace.
- [ ] Build a client workspace that shows risk/compliance fields, source evidence, copy compliance packet, editable metadata, workflow form, save buttons, and mark reviewed.
- [ ] Link each register card to the detail route.

### Task 4: Verification

**Files:**
- All changed files

- [ ] Run `npm test --workspace=web`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit the completed feature.
