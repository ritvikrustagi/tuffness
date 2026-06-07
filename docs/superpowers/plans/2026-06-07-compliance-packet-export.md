# Compliance Packet Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add copy/export actions that generate a clean text compliance packet from a risk detail item.

**Architecture:** Implement a tested pure packet builder in `lib/risks`, then wire it into the existing risk detail action hook and page buttons.

**Tech Stack:** Next.js, React, TypeScript, Vitest, existing risk/workflow helpers.

---

### Task 1: Packet Builder

**Files:**
- Create: `apps/web/lib/risks/packet.ts`
- Test: `apps/web/lib/risks/packet.test.ts`

- [ ] Write tests for complete packet content, missing-field fallbacks, draft RFI inclusion, and no `undefined` text.
- [ ] Run `npm test --workspace=web -- lib/risks/packet.test.ts` and confirm the tests fail because the helper is missing.
- [ ] Implement `buildCompliancePacketText` and `buildCompliancePacketDownloadName`.
- [ ] Re-run the packet tests and confirm they pass.

### Task 2: Detail Page Actions

**Files:**
- Modify: `apps/web/components/risks/use-risk-detail-actions.ts`
- Modify: `apps/web/components/risks/risk-detail-workspace.tsx`

- [ ] Add hook actions for copying and exporting a compliance packet.
- [ ] Add `Copy packet` and `Export packet` buttons on the risk detail page.
- [ ] Keep the existing compliance packet copy action working for the shorter legacy text.

### Task 3: Verification

**Files:**
- All changed files

- [ ] Run `npm test --workspace=web`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit the completed feature.
