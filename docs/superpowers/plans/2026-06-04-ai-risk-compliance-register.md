# AI Risk + Compliance Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Compliance Register MVP on top of the existing AI Risk Register for GC project engineers.

**Architecture:** Reuse existing `issues` risk metadata and `risk_agent` runs. Add pure compliance helpers for grouping, filtering, summaries, and export; extend the existing Risks UI with a compliance view; add a compliance scan endpoint that runs the same risk agent with compliance-focused prompt mode.

**Tech Stack:** Next.js App Router, React client components, Supabase, Vitest, TypeScript, existing OpenAI risk agent.

---

### Task 1: Compliance Helpers

**Files:**
- Create: `apps/web/lib/risks/compliance.ts`
- Test: `apps/web/lib/risks/compliance.test.ts`
- Modify: `apps/web/lib/risks/types.ts`

- [ ] Write tests for compliance group derivation, compliance filtering, summary counts, and copy packet text.
- [ ] Implement `getComplianceGroup`, `isComplianceRisk`, `summarizeComplianceRisks`, and `buildComplianceItemText`.
- [ ] Run `npm test --workspace=web -- lib/risks/compliance.test.ts`.

### Task 2: Compliance Export

**Files:**
- Modify: `apps/web/lib/risks/export.ts`
- Test: `apps/web/lib/risks/summary.test.ts`

- [ ] Add tests for Compliance Register CSV headers and formula neutralization.
- [ ] Implement `buildComplianceCsv` using existing CSV safety behavior.
- [ ] Run `npm test --workspace=web -- lib/risks/summary.test.ts`.

### Task 3: Compliance UI View

**Files:**
- Modify: `apps/web/components/risks/risk-register.tsx`
- Modify: `apps/web/components/risks/risk-card.tsx`
- Modify: `apps/web/app/(dashboard)/projects/[projectId]/risks/page.tsx`
- Modify: `apps/web/components/agents/risk-scan-button.tsx`

- [ ] Add All Risks / Compliance view switch.
- [ ] Add compliance summary cards and required artifact filter.
- [ ] Add Compliance CSV export and copy item packet.
- [ ] Add Scan Compliance button mode.

### Task 4: Compliance Scan Route and Prompt Mode

**Files:**
- Modify: `apps/web/lib/agents/risk/analyze.ts`
- Modify: `apps/web/lib/agents/risk/analyze.test.ts`
- Modify: `apps/web/lib/agents/risk/runner.ts`
- Modify: `apps/web/lib/agents/risk/runner.test.ts`
- Create: `apps/web/app/api/projects/[projectId]/agents/compliance-scan/route.ts`

- [ ] Add `RiskScanMode = "risk_register_scan" | "compliance_register_scan"`.
- [ ] Make prompt builder render compliance-focused instructions in compliance mode.
- [ ] Make `runRiskScan` accept mode and persist it in summary/input flow.
- [ ] Add route that creates a `risk_agent` run with `input_params.mode = "compliance_register_scan"`.

### Task 5: Verification

**Files:**
- Verify all changed files.

- [ ] Run `npm test --workspace=web`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit the implementation.
