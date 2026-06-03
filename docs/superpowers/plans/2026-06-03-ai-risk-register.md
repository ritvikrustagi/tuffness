# AI Risk Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first AI Risk Register for GC project engineers: ranked issue log, cost/schedule/compliance impact metadata, evidence, filters, dashboard summaries, CSV export, and an AI risk scan route.

**Architecture:** Extend the existing `issues` workflow instead of creating a parallel risk system. Add typed risk metadata, deterministic scoring helpers, a Supabase migration, focused API/query helpers, a Risk Register page, dashboard summary modules, and an agent path that reuses the existing RFI retrieval/LLM/persistence pattern.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase/Postgres migrations, Zod, Vitest, existing OpenAI chat client and RAG chunks.

---

## File Structure

Create:

- `supabase/migrations/008_ai_risk_register.sql` — adds risk metadata columns to `issues`, indexes, and check constraints.
- `apps/web/lib/risks/types.ts` — canonical risk enums and TypeScript types.
- `apps/web/lib/risks/scoring.ts` — deterministic risk scoring and tiering helpers.
- `apps/web/lib/risks/summary.ts` — risk dashboard/register summary helpers.
- `apps/web/lib/risks/export.ts` — CSV export helpers.
- `apps/web/lib/risks/validation.ts` — Zod schemas for risk metadata patches.
- `apps/web/lib/risks/scoring.test.ts` — scoring tests.
- `apps/web/lib/risks/summary.test.ts` — summary/export tests.
- `apps/web/lib/agents/risk/schema.ts` — risk scan LLM output schema.
- `apps/web/lib/agents/risk/analyze.ts` — LLM analysis prompt for risk findings.
- `apps/web/lib/agents/risk/runner.ts` — risk scan runner and persistence.
- `apps/web/app/api/projects/[projectId]/agents/risk-scan/route.ts` — starts risk scan agent runs.
- `apps/web/app/api/projects/[projectId]/risks/route.ts` — lists project risk issues.
- `apps/web/app/(dashboard)/projects/[projectId]/risks/page.tsx` — Risk Register page.
- `apps/web/components/agents/risk-scan-button.tsx` — run risk scan button.
- `apps/web/components/risks/risk-register.tsx` — client-side filters, list, CSV export.
- `apps/web/components/risks/risk-card.tsx` — risk item display and source evidence.

Modify:

- `apps/web/lib/types/database.ts` — add risk metadata fields and `risk_agent` agent type.
- `apps/web/lib/projects/dashboard.ts` — include risk summaries and top risks.
- `apps/web/lib/projects/dashboard.test.ts` — cover risk summary data.
- `apps/web/components/projects/project-overview.tsx` — show Top Risks and Compliance Exposure.
- `apps/web/components/projects/project-tabs.tsx` — add Risks tab.
- `apps/web/components/issues/issue-display.ts` — optionally expose risk display labels for shared cards.
- `apps/web/app/api/projects/[projectId]/issues/[issueId]/route.ts` — allow risk metadata patches if the risk page reuses issue workflow patching.

Do not:

- Create a new standalone `risks` table in this MVP.
- Bypass the existing issue/RFI workflow state model.
- Let the agent create risk findings without evidence.

---

### Task 1: Risk Types, Scoring, and Summary Helpers

**Files:**

- Create: `apps/web/lib/risks/types.ts`
- Create: `apps/web/lib/risks/scoring.ts`
- Create: `apps/web/lib/risks/summary.ts`
- Create: `apps/web/lib/risks/export.ts`
- Test: `apps/web/lib/risks/scoring.test.ts`
- Test: `apps/web/lib/risks/summary.test.ts`

- [ ] **Step 1: Write failing scoring tests**

Create `apps/web/lib/risks/scoring.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { calculateRiskScore, getRiskTier } from "./scoring";

describe("risk scoring", () => {
  test("ranks critical compliance exposure high even when cost is unknown", () => {
    const result = calculateRiskScore({
      severity: "medium",
      cost_impact: "none",
      schedule_impact: "low",
      compliance_impact: "code_or_life_safety",
      confidence: 0.72,
      evidence_count: 2,
      blocks_work: false,
    });

    expect(result.risk_tier).toBe("critical");
    expect(result.risk_score).toBeGreaterThanOrEqual(80);
  });

  test("penalizes weak confidence without hiding high schedule risk", () => {
    const result = calculateRiskScore({
      severity: "high",
      cost_impact: "medium",
      schedule_impact: "critical",
      compliance_impact: "none",
      confidence: 0.42,
      evidence_count: 1,
      blocks_work: true,
    });

    expect(result.risk_tier).toBe("high");
    expect(result.risk_score).toBeGreaterThanOrEqual(60);
    expect(result.risk_score).toBeLessThan(90);
  });

  test("maps numeric scores to stable tiers", () => {
    expect(getRiskTier(90)).toBe("critical");
    expect(getRiskTier(70)).toBe("high");
    expect(getRiskTier(45)).toBe("medium");
    expect(getRiskTier(10)).toBe("low");
  });
});
```

- [ ] **Step 2: Write failing summary and export tests**

Create `apps/web/lib/risks/summary.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildRiskCsv } from "./export";
import { summarizeRisks } from "./summary";

const risks = [
  {
    id: "risk-1",
    summary: "Fire door rating missing",
    status: "open",
    risk_tier: "critical",
    compliance_impact: "code_or_life_safety",
    required_artifact: "rfi",
    confidence: 0.88,
  },
  {
    id: "risk-2",
    summary: "Door hardware submittal required",
    status: "draft_rfi",
    risk_tier: "high",
    compliance_impact: "submittal_required",
    required_artifact: "submittal",
    confidence: 0.76,
  },
  {
    id: "risk-3",
    summary: "Resolved paint question",
    status: "resolved",
    risk_tier: "low",
    compliance_impact: "none",
    required_artifact: "none",
    confidence: 0.9,
  },
] as const;

describe("risk summaries", () => {
  test("summarizes open risk exposure", () => {
    expect(summarizeRisks(risks)).toEqual({
      total: 3,
      open: 2,
      critical_or_high: 2,
      compliance_exposure: 2,
      draft_rfis_needed: 1,
      awaiting_review: 2,
      closed: 1,
    });
  });

  test("exports risk register rows as CSV", () => {
    const csv = buildRiskCsv([
      {
        risk_tier: "critical",
        summary: "Fire door rating missing",
        risk_category: "possible_spec_deviation",
        cost_impact: "medium",
        schedule_impact: "high",
        compliance_impact: "code_or_life_safety",
        trade: "doors/hardware",
        responsible_party: "Architect",
        spec_section: "08 11 13",
        drawing_sheet: "A601",
        required_artifact: "rfi",
        confidence: 0.88,
        status: "open",
        recommended_action: "Draft RFI for rating confirmation.",
        evidence: [{ document_name: "A601", page_number: 12, quote: "Door rating not shown." }],
      },
    ]);

    expect(csv).toContain("Risk Tier,Summary,Risk Category");
    expect(csv).toContain("\"critical\",\"Fire door rating missing\"");
    expect(csv).toContain("\"A601 p.12: Door rating not shown.\"");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test --workspace=web -- lib/risks/scoring.test.ts lib/risks/summary.test.ts
```

Expected: FAIL because `./scoring`, `./summary`, and `./export` do not exist.

- [ ] **Step 4: Implement risk types**

Create `apps/web/lib/risks/types.ts`:

```ts
import type { IssueStatus } from "../types/database";

export const riskCategories = [
  "drawing_spec_conflict",
  "missing_information",
  "coordination_conflict",
  "submittal_requirement",
  "possible_spec_deviation",
  "owner_design_approval",
  "schedule_constraint",
  "cost_exposure",
  "closeout_risk",
  "other",
] as const;

export const impactLevels = ["none", "low", "medium", "high", "critical"] as const;

export const complianceImpacts = [
  "none",
  "possible_noncompliance",
  "spec_deviation",
  "code_or_life_safety",
  "submittal_required",
  "owner_approval_required",
  "inspection_or_testing_required",
  "closeout_required",
] as const;

export const requiredArtifacts = [
  "none",
  "rfi",
  "submittal",
  "test_report",
  "owner_approval",
  "inspection",
  "closeout_document",
] as const;

export const riskTiers = ["low", "medium", "high", "critical"] as const;

export type RiskCategory = (typeof riskCategories)[number];
export type ImpactLevel = (typeof impactLevels)[number];
export type ComplianceImpact = (typeof complianceImpacts)[number];
export type RequiredArtifact = (typeof requiredArtifacts)[number];
export type RiskTier = (typeof riskTiers)[number];

export type RiskEvidence = {
  document_name?: string;
  page_number?: number;
  quote?: string;
  excerpt?: string;
};

export type RiskLike = {
  id?: string;
  summary: string;
  status: IssueStatus;
  risk_tier: RiskTier | null;
  risk_category?: RiskCategory | null;
  cost_impact?: ImpactLevel | null;
  schedule_impact?: ImpactLevel | null;
  compliance_impact: ComplianceImpact | null;
  trade?: string | null;
  responsible_party?: string | null;
  spec_section?: string | null;
  drawing_sheet?: string | null;
  required_artifact: RequiredArtifact | null;
  confidence?: number | null;
  recommended_action?: string | null;
  evidence?: RiskEvidence[] | null;
};
```

- [ ] **Step 5: Implement scoring**

Create `apps/web/lib/risks/scoring.ts`:

```ts
import type { ComplianceImpact, ImpactLevel, RiskTier } from "./types";
import type { IssueSeverity } from "../types/database";

const impactPoints: Record<ImpactLevel, number> = {
  none: 0,
  low: 10,
  medium: 24,
  high: 38,
  critical: 52,
};

const severityPoints: Record<IssueSeverity, number> = {
  low: 4,
  medium: 12,
  high: 22,
  critical: 32,
};

const compliancePoints: Record<ComplianceImpact, number> = {
  none: 0,
  possible_noncompliance: 18,
  spec_deviation: 28,
  code_or_life_safety: 58,
  submittal_required: 22,
  owner_approval_required: 24,
  inspection_or_testing_required: 26,
  closeout_required: 18,
};

export type RiskScoringInput = {
  severity: IssueSeverity;
  cost_impact: ImpactLevel;
  schedule_impact: ImpactLevel;
  compliance_impact: ComplianceImpact;
  confidence: number | null | undefined;
  evidence_count: number;
  blocks_work: boolean;
};

export type RiskScoreResult = {
  risk_score: number;
  risk_tier: RiskTier;
};

export function getRiskTier(score: number): RiskTier {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export function calculateRiskScore(input: RiskScoringInput): RiskScoreResult {
  const strongestImpact = Math.max(
    impactPoints[input.cost_impact],
    impactPoints[input.schedule_impact]
  );
  const confidence = Math.max(0, Math.min(input.confidence ?? 0.5, 1));
  const evidenceBonus = Math.min(input.evidence_count, 3) * 4;
  const blockerBonus = input.blocks_work ? 10 : 0;
  const confidenceModifier = confidence < 0.5 ? -12 : confidence >= 0.8 ? 8 : 0;

  const rawScore =
    strongestImpact +
    severityPoints[input.severity] +
    compliancePoints[input.compliance_impact] +
    evidenceBonus +
    blockerBonus +
    confidenceModifier;

  const risk_score = Math.max(0, Math.min(Math.round(rawScore), 100));

  return {
    risk_score,
    risk_tier: getRiskTier(risk_score),
  };
}
```

- [ ] **Step 6: Implement summary and export helpers**

Create `apps/web/lib/risks/summary.ts`:

```ts
import type { RiskLike } from "./types";

const closedStatuses = new Set(["resolved", "dismissed"]);

export type RiskSummary = {
  total: number;
  open: number;
  critical_or_high: number;
  compliance_exposure: number;
  draft_rfis_needed: number;
  awaiting_review: number;
  closed: number;
};

export function summarizeRisks(risks: readonly RiskLike[]): RiskSummary {
  return risks.reduce<RiskSummary>(
    (summary, risk) => {
      const closed = closedStatuses.has(risk.status);
      summary.total += 1;
      if (closed) summary.closed += 1;
      if (!closed) summary.open += 1;
      if (!closed && (risk.risk_tier === "critical" || risk.risk_tier === "high")) {
        summary.critical_or_high += 1;
      }
      if (!closed && risk.compliance_impact && risk.compliance_impact !== "none") {
        summary.compliance_exposure += 1;
      }
      if (!closed && risk.required_artifact === "rfi") {
        summary.draft_rfis_needed += 1;
      }
      if (!closed && !risk.id?.startsWith("reviewed:")) {
        summary.awaiting_review += 1;
      }
      return summary;
    },
    {
      total: 0,
      open: 0,
      critical_or_high: 0,
      compliance_exposure: 0,
      draft_rfis_needed: 0,
      awaiting_review: 0,
      closed: 0,
    }
  );
}
```

Create `apps/web/lib/risks/export.ts`:

```ts
import type { RiskLike } from "./types";

const headers = [
  "Risk Tier",
  "Summary",
  "Risk Category",
  "Cost Impact",
  "Schedule Impact",
  "Compliance Impact",
  "Trade",
  "Responsible Party",
  "Spec Section",
  "Drawing Sheet",
  "Required Artifact",
  "Confidence",
  "Workflow State",
  "Recommended Action",
  "Evidence References",
];

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function evidenceText(risk: RiskLike): string {
  return (risk.evidence ?? [])
    .map((item) => {
      const source = [item.document_name, item.page_number ? `p.${item.page_number}` : ""]
        .filter(Boolean)
        .join(" ");
      const quote = item.quote ?? item.excerpt ?? "";
      return [source, quote].filter(Boolean).join(": ");
    })
    .join(" | ");
}

export function buildRiskCsv(risks: readonly RiskLike[]): string {
  const rows = risks.map((risk) =>
    [
      risk.risk_tier,
      risk.summary,
      risk.risk_category,
      risk.cost_impact,
      risk.schedule_impact,
      risk.compliance_impact,
      risk.trade,
      risk.responsible_party,
      risk.spec_section,
      risk.drawing_sheet,
      risk.required_artifact,
      risk.confidence,
      risk.status,
      risk.recommended_action,
      evidenceText(risk),
    ].map(csvCell).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm test --workspace=web -- lib/risks/scoring.test.ts lib/risks/summary.test.ts
```

Expected: PASS.

Commit:

```bash
git add apps/web/lib/risks
git commit -m "Add risk scoring helpers"
```

---

### Task 2: Database and Shared Types

**Files:**

- Create: `supabase/migrations/008_ai_risk_register.sql`
- Modify: `apps/web/lib/types/database.ts`
- Test: `apps/web/lib/risks/scoring.test.ts`

- [ ] **Step 1: Add a type assertion test for the new issue fields**

Append to `apps/web/lib/risks/scoring.test.ts`:

```ts
import type { Issue } from "../types/database";

test("database Issue type exposes risk register metadata", () => {
  const issue = {
    risk_category: "possible_spec_deviation",
    risk_score: 88,
    risk_tier: "critical",
    cost_impact: "medium",
    schedule_impact: "high",
    compliance_impact: "code_or_life_safety",
    responsible_party: "Architect",
    responsible_trade: "doors/hardware",
    spec_section: "08 11 13",
    drawing_sheet: "A601",
    required_artifact: "rfi",
    blocked_activity: "Door frame release",
    risk_reasoning: "The door schedule lacks a fire rating while the spec requires rated openings.",
    evidence_strength: "strong",
    human_reviewed_at: null,
    human_reviewed_by: null,
  } satisfies Pick<
    Issue,
    | "risk_category"
    | "risk_score"
    | "risk_tier"
    | "cost_impact"
    | "schedule_impact"
    | "compliance_impact"
    | "responsible_party"
    | "responsible_trade"
    | "spec_section"
    | "drawing_sheet"
    | "required_artifact"
    | "blocked_activity"
    | "risk_reasoning"
    | "evidence_strength"
    | "human_reviewed_at"
    | "human_reviewed_by"
  >;

  expect(issue.risk_tier).toBe("critical");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test --workspace=web -- lib/risks/scoring.test.ts
```

Expected: FAIL because `Issue` does not expose risk metadata fields yet.

- [ ] **Step 3: Add Supabase migration**

Create `supabase/migrations/008_ai_risk_register.sql`:

```sql
-- Phase 8: AI Risk Register metadata

ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'risk_agent';

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS risk_category TEXT,
  ADD COLUMN IF NOT EXISTS risk_score INT,
  ADD COLUMN IF NOT EXISTS risk_tier TEXT,
  ADD COLUMN IF NOT EXISTS cost_impact TEXT,
  ADD COLUMN IF NOT EXISTS schedule_impact TEXT,
  ADD COLUMN IF NOT EXISTS compliance_impact TEXT,
  ADD COLUMN IF NOT EXISTS responsible_party TEXT,
  ADD COLUMN IF NOT EXISTS responsible_trade TEXT,
  ADD COLUMN IF NOT EXISTS spec_section TEXT,
  ADD COLUMN IF NOT EXISTS drawing_sheet TEXT,
  ADD COLUMN IF NOT EXISTS required_artifact TEXT,
  ADD COLUMN IF NOT EXISTS blocked_activity TEXT,
  ADD COLUMN IF NOT EXISTS risk_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS evidence_strength TEXT,
  ADD COLUMN IF NOT EXISTS human_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.issues
  ADD CONSTRAINT issues_risk_category_check CHECK (
    risk_category IS NULL OR risk_category IN (
      'drawing_spec_conflict',
      'missing_information',
      'coordination_conflict',
      'submittal_requirement',
      'possible_spec_deviation',
      'owner_design_approval',
      'schedule_constraint',
      'cost_exposure',
      'closeout_risk',
      'other'
    )
  ),
  ADD CONSTRAINT issues_risk_score_check CHECK (
    risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)
  ),
  ADD CONSTRAINT issues_risk_tier_check CHECK (
    risk_tier IS NULL OR risk_tier IN ('low', 'medium', 'high', 'critical')
  ),
  ADD CONSTRAINT issues_cost_impact_check CHECK (
    cost_impact IS NULL OR cost_impact IN ('none', 'low', 'medium', 'high', 'critical')
  ),
  ADD CONSTRAINT issues_schedule_impact_check CHECK (
    schedule_impact IS NULL OR schedule_impact IN ('none', 'low', 'medium', 'high', 'critical')
  ),
  ADD CONSTRAINT issues_compliance_impact_check CHECK (
    compliance_impact IS NULL OR compliance_impact IN (
      'none',
      'possible_noncompliance',
      'spec_deviation',
      'code_or_life_safety',
      'submittal_required',
      'owner_approval_required',
      'inspection_or_testing_required',
      'closeout_required'
    )
  ),
  ADD CONSTRAINT issues_required_artifact_check CHECK (
    required_artifact IS NULL OR required_artifact IN (
      'none',
      'rfi',
      'submittal',
      'test_report',
      'owner_approval',
      'inspection',
      'closeout_document'
    )
  ),
  ADD CONSTRAINT issues_evidence_strength_check CHECK (
    evidence_strength IS NULL OR evidence_strength IN ('weak', 'moderate', 'strong')
  );

CREATE INDEX IF NOT EXISTS idx_issues_risk_register
  ON public.issues(project_id, risk_tier, risk_score DESC)
  WHERE risk_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_issues_compliance_impact
  ON public.issues(project_id, compliance_impact)
  WHERE compliance_impact IS NOT NULL AND compliance_impact <> 'none';

CREATE INDEX IF NOT EXISTS idx_issues_responsible_trade
  ON public.issues(project_id, responsible_trade)
  WHERE responsible_trade IS NOT NULL;
```

- [ ] **Step 4: Update database TypeScript types**

Modify `apps/web/lib/types/database.ts`:

```ts
export type AgentType =
  | "rfi_scan"
  | "rfi_agent"
  | "risk_agent"
  | "submittal_review"
  | "document_process";
```

Add imports near the risk type definitions:

```ts
export type RiskCategory =
  | "drawing_spec_conflict"
  | "missing_information"
  | "coordination_conflict"
  | "submittal_requirement"
  | "possible_spec_deviation"
  | "owner_design_approval"
  | "schedule_constraint"
  | "cost_exposure"
  | "closeout_risk"
  | "other";
export type ImpactLevel = "none" | "low" | "medium" | "high" | "critical";
export type ComplianceImpact =
  | "none"
  | "possible_noncompliance"
  | "spec_deviation"
  | "code_or_life_safety"
  | "submittal_required"
  | "owner_approval_required"
  | "inspection_or_testing_required"
  | "closeout_required";
export type RequiredArtifact =
  | "none"
  | "rfi"
  | "submittal"
  | "test_report"
  | "owner_approval"
  | "inspection"
  | "closeout_document";
export type RiskTier = "low" | "medium" | "high" | "critical";
export type EvidenceStrength = "weak" | "moderate" | "strong";
```

Add fields to `Issue`:

```ts
  risk_category: RiskCategory | null;
  risk_score: number | null;
  risk_tier: RiskTier | null;
  cost_impact: ImpactLevel | null;
  schedule_impact: ImpactLevel | null;
  compliance_impact: ComplianceImpact | null;
  responsible_party: string | null;
  responsible_trade: string | null;
  spec_section: string | null;
  drawing_sheet: string | null;
  required_artifact: RequiredArtifact | null;
  blocked_activity: string | null;
  risk_reasoning: string | null;
  evidence_strength: EvidenceStrength | null;
  human_reviewed_at: string | null;
  human_reviewed_by: string | null;
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test --workspace=web -- lib/risks/scoring.test.ts
npm run lint
```

Expected: PASS.

Commit:

```bash
git add supabase/migrations/008_ai_risk_register.sql apps/web/lib/types/database.ts apps/web/lib/risks/scoring.test.ts
git commit -m "Add risk register database fields"
```

---

### Task 3: Risk Metadata Validation and API Listing

**Files:**

- Create: `apps/web/lib/risks/validation.ts`
- Create: `apps/web/app/api/projects/[projectId]/risks/route.ts`
- Modify: `apps/web/app/api/projects/[projectId]/issues/[issueId]/route.ts`

- [ ] **Step 1: Add validation schema**

Create `apps/web/lib/risks/validation.ts`:

```ts
import { z } from "zod";
import {
  complianceImpacts,
  impactLevels,
  requiredArtifacts,
  riskCategories,
  riskTiers,
} from "./types";

const emptyToNull = z.preprocess((value) => (value === "" ? null : value), z.string().nullable());

export const riskMetadataPatchSchema = z.object({
  risk_category: z.enum(riskCategories).nullable().optional(),
  risk_score: z.number().int().min(0).max(100).nullable().optional(),
  risk_tier: z.enum(riskTiers).nullable().optional(),
  cost_impact: z.enum(impactLevels).nullable().optional(),
  schedule_impact: z.enum(impactLevels).nullable().optional(),
  compliance_impact: z.enum(complianceImpacts).nullable().optional(),
  responsible_party: emptyToNull.optional(),
  responsible_trade: emptyToNull.optional(),
  spec_section: emptyToNull.optional(),
  drawing_sheet: emptyToNull.optional(),
  required_artifact: z.enum(requiredArtifacts).nullable().optional(),
  blocked_activity: emptyToNull.optional(),
  risk_reasoning: emptyToNull.optional(),
  evidence_strength: z.enum(["weak", "moderate", "strong"]).nullable().optional(),
});

export type RiskMetadataPatch = z.infer<typeof riskMetadataPatchSchema>;
```

- [ ] **Step 2: Add risk list API**

Create `apps/web/app/api/projects/[projectId]/risks/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import type { Issue } from "@/lib/types/database";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { data, error } = await supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("project_id", projectId)
    .not("risk_tier", "is", null)
    .order("risk_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ risks: (data ?? []) as Issue[] });
}
```

- [ ] **Step 3: Allow risk metadata in issue patch route**

Modify `apps/web/app/api/projects/[projectId]/issues/[issueId]/route.ts`:

```ts
import { riskMetadataPatchSchema } from "@/lib/risks/validation";
```

Change the schema declaration from:

```ts
const issueUpdateSchema = z.object({
  workflow_state: z.enum(issueWorkflowStates),
  status: z.enum(issueStatuses).optional(),
  rfi_status: z.enum(rfiStatuses).optional(),
  subject: z.string().max(200).nullable().optional(),
  resolution_notes: z.string().max(4000).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  trade: z.string().max(100).nullable().optional(),
  discipline: z.string().max(100).nullable().optional(),
  due_date: z.string().nullable().optional(),
  external_system_url: z.string().max(1000).nullable().optional(),
  draft_rfi: z.string().max(4000).nullable().optional(),
  external_rfi_number: z.string().max(100).nullable().optional(),
  external_url: z.string().max(1000).nullable().optional(),
  response: z.string().max(4000).nullable().optional(),
});
```

to:

```ts
const workflowUpdateSchema = z.object({
  workflow_state: z.enum(issueWorkflowStates),
  status: z.enum(issueStatuses).optional(),
  rfi_status: z.enum(rfiStatuses).optional(),
  subject: z.string().max(200).nullable().optional(),
  resolution_notes: z.string().max(4000).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  trade: z.string().max(100).nullable().optional(),
  discipline: z.string().max(100).nullable().optional(),
  due_date: z.string().nullable().optional(),
  external_system_url: z.string().max(1000).nullable().optional(),
  draft_rfi: z.string().max(4000).nullable().optional(),
  external_rfi_number: z.string().max(100).nullable().optional(),
  external_url: z.string().max(1000).nullable().optional(),
  response: z.string().max(4000).nullable().optional(),
});

const issueUpdateSchema = workflowUpdateSchema.extend(riskMetadataPatchSchema.shape);

function hasRiskMetadataPatch(patch: z.infer<typeof riskMetadataPatchSchema>) {
  return Object.values(patch).some((value) => value !== undefined);
}
```

After the existing `save_issue_workflow` RPC call succeeds, add a separate risk metadata update:

```ts
  const riskPatch = riskMetadataPatchSchema.parse(parsed.data);
  if (hasRiskMetadataPatch(riskPatch)) {
    const { error: riskError } = await supabase
      .from("issues")
      .update({
        ...riskPatch,
        human_reviewed_at: new Date().toISOString(),
        human_reviewed_by: user.id,
      })
      .eq("id", issueId)
      .eq("project_id", projectId);

    if (riskError) {
      return NextResponse.json({ error: riskError.message }, { status: 500 });
    }
  }
```

Keep the existing workflow-state transition validation exactly where it is. The route still calls `buildIssueWorkflowRpcPatch(parsed.data)` for workflow fields, so clients cannot use risk metadata patches to bypass `workflow_state` invariants.

- [ ] **Step 4: Verify route compiles**

Run:

```bash
npm run lint
npm run build
```

Expected: PASS.

Commit:

```bash
git add apps/web/lib/risks/validation.ts 'apps/web/app/api/projects/[projectId]/risks/route.ts' 'apps/web/app/api/projects/[projectId]/issues/[issueId]/route.ts'
git commit -m "Add risk metadata API support"
```

---

### Task 4: Risk Scan Agent

**Files:**

- Create: `apps/web/lib/agents/risk/schema.ts`
- Create: `apps/web/lib/agents/risk/analyze.ts`
- Create: `apps/web/lib/agents/risk/runner.ts`
- Create: `apps/web/app/api/projects/[projectId]/agents/risk-scan/route.ts`
- Modify: `apps/web/lib/agents/rfi/topics.ts` only if a shared retrieval helper needs to be exported.

- [ ] **Step 1: Write risk schema tests**

Create `apps/web/lib/agents/risk/schema.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { riskAgentOutputSchema } from "./schema";

describe("risk agent schema", () => {
  test("requires evidence-backed risk findings", () => {
    const result = riskAgentOutputSchema.safeParse({
      risks: [
        {
          risk_category: "possible_spec_deviation",
          severity: "high",
          cost_impact: "medium",
          schedule_impact: "high",
          compliance_impact: "code_or_life_safety",
          responsible_party: "Architect",
          responsible_trade: "doors/hardware",
          spec_section: "08 11 13",
          drawing_sheet: "A601",
          required_artifact: "rfi",
          blocked_activity: "Door frame release",
          summary: "Fire door rating is missing from the door schedule",
          description: "The spec requires rated openings, but the cited schedule excerpt does not list a rating.",
          evidence: [
            {
              document_id: "11111111-1111-4111-8111-111111111111",
              document_name: "A601 Door Schedule",
              page_number: 12,
              quote: "Rating column is blank for Door 101.",
            },
          ],
          draft_rfi: "Please confirm the required fire rating for Door 101.",
          confidence: 0.82,
          evidence_strength: "strong",
          recommended_action: "Review the cited schedule and submit the draft RFI if confirmed.",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  test("rejects risk findings without evidence", () => {
    const result = riskAgentOutputSchema.safeParse({
      risks: [
        {
          risk_category: "cost_exposure",
          severity: "high",
          cost_impact: "high",
          schedule_impact: "medium",
          compliance_impact: "none",
          required_artifact: "none",
          summary: "Unsupported cost risk",
          evidence: [],
          confidence: 0.8,
          evidence_strength: "weak",
          recommended_action: "Review.",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run schema test to verify it fails**

Run:

```bash
npm test --workspace=web -- lib/agents/risk/schema.test.ts
```

Expected: FAIL because `./schema` does not exist.

- [ ] **Step 3: Implement risk agent schema**

Create `apps/web/lib/agents/risk/schema.ts`:

```ts
import { z } from "zod";
import {
  complianceImpacts,
  impactLevels,
  requiredArtifacts,
  riskCategories,
} from "@/lib/risks/types";

export const riskEvidenceSchema = z.object({
  document_id: z.string().uuid(),
  document_name: z.string().min(1),
  page_number: z.number().int().positive(),
  quote: z.string().min(1),
});

export const riskFindingSchema = z.object({
  risk_category: z.enum(riskCategories),
  severity: z.enum(["low", "medium", "high", "critical"]),
  cost_impact: z.enum(impactLevels),
  schedule_impact: z.enum(impactLevels),
  compliance_impact: z.enum(complianceImpacts),
  responsible_party: z.string().min(1).max(200).optional(),
  responsible_trade: z.string().min(1).max(120).optional(),
  spec_section: z.string().min(1).max(80).optional(),
  drawing_sheet: z.string().min(1).max(80).optional(),
  required_artifact: z.enum(requiredArtifacts),
  blocked_activity: z.string().min(1).max(300).optional(),
  summary: z.string().min(1).max(500),
  description: z.string().min(1).max(2500),
  evidence: z.array(riskEvidenceSchema).min(1).max(10),
  draft_rfi: z.string().min(1).max(4000).optional(),
  confidence: z.number().min(0).max(1),
  evidence_strength: z.enum(["weak", "moderate", "strong"]),
  recommended_action: z.string().min(1).max(1000),
});

export const riskAgentOutputSchema = z.object({
  risks: z.array(riskFindingSchema).max(10),
});

export type RiskFinding = z.infer<typeof riskFindingSchema>;
export type RiskAgentOutput = z.infer<typeof riskAgentOutputSchema>;
```

- [ ] **Step 4: Implement risk analysis prompt**

Create `apps/web/lib/agents/risk/analyze.ts` by following `apps/web/lib/agents/rfi/analyze.ts` and changing the prompt/schema:

```ts
import { getChatModel, getOpenAIClient } from "@/lib/openai/client";
import { formatChunksForPrompt, type ConstructionTopic } from "@/lib/agents/rfi/topics";
import type { MatchedChunk } from "@/lib/rag/types";
import { riskAgentOutputSchema, type RiskAgentOutput } from "./schema";

const LLM_TIMEOUT_MS = 45_000;

export class RiskAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: "llm_timeout" | "invalid_json" | "validation_failed"
  ) {
    super(message);
    this.name = "RiskAnalysisError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new RiskAnalysisError("LLM request timed out", "llm_timeout")), ms)
    ),
  ]);
}

export async function analyzeRiskTopicGroup(
  topic: ConstructionTopic,
  chunks: MatchedChunk[]
): Promise<RiskAgentOutput> {
  const openai = getOpenAIClient();
  const context = formatChunksForPrompt(chunks);

  const systemPrompt = `You are a senior construction project engineer building an AI Risk Register for a general contractor.

Analyze the document excerpts for the topic: ${topic.label}.

Find only evidence-backed project risks:
- cost exposure
- schedule blockers
- drawing/spec conflicts
- missing information
- trade coordination conflicts
- possible spec deviation
- owner/design approval needs
- submittal, inspection, testing, or closeout requirements

Rules:
1. Return JSON only matching the required schema.
2. Every risk must cite exact evidence with document_id, document_name, page_number, and quote.
3. Do not create risks without evidence.
4. Do not claim legal/code compliance failure; use code_or_life_safety only when project documents support the concern.
5. responsible_party should be a likely role or company type such as Architect, Structural Engineer, Owner, GC, or trade.
6. required_artifact must be one of: none, rfi, submittal, test_report, owner_approval, inspection, closeout_document.
7. confidence must be 0 to 1 based only on evidence strength.
8. Maximum 5 risks per topic.
9. Prefer fewer high-signal findings over broad issue spam.`;

  const userPrompt = `Topic: ${topic.label}

Document excerpts:
${context}

Return JSON:
{
  "risks": [
    {
      "risk_category": "possible_spec_deviation",
      "severity": "high",
      "cost_impact": "medium",
      "schedule_impact": "high",
      "compliance_impact": "code_or_life_safety",
      "responsible_party": "Architect",
      "responsible_trade": "doors/hardware",
      "spec_section": "08 11 13",
      "drawing_sheet": "A601",
      "required_artifact": "rfi",
      "blocked_activity": "Door frame release",
      "summary": "...",
      "description": "...",
      "evidence": [
        {
          "document_id": "uuid",
          "document_name": "...",
          "page_number": 1,
          "quote": "..."
        }
      ],
      "draft_rfi": "...",
      "confidence": 0.85,
      "evidence_strength": "strong",
      "recommended_action": "..."
    }
  ]
}`;

  const completion = await withTimeout(
    openai.chat.completions.create({
      model: getChatModel(),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    LLM_TIMEOUT_MS
  );

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new RiskAnalysisError("Empty LLM response", "invalid_json");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RiskAnalysisError("LLM returned invalid JSON", "invalid_json");
  }

  const validated = riskAgentOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new RiskAnalysisError(
      `Schema validation failed: ${validated.error.message}`,
      "validation_failed"
    );
  }

  return validated.data;
}
```

- [ ] **Step 5: Implement runner and route**

Create `apps/web/lib/agents/risk/runner.ts` by adapting the RFI runner, using `calculateRiskScore()` and inserting `issues` with risk metadata:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveTopicChunkGroups } from "@/lib/agents/rfi/topics";
import { normalizeIssueEvidence } from "@/lib/issues/workflow";
import { calculateRiskScore } from "@/lib/risks/scoring";
import { analyzeRiskTopicGroup, RiskAnalysisError } from "./analyze";
import type { RiskFinding } from "./schema";

export class RiskScanError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "no_documents"
      | "no_chunks"
      | "llm_timeout"
      | "invalid_json"
      | "validation_failed"
      | "db_error"
  ) {
    super(message);
    this.name = "RiskScanError";
  }
}

export interface RiskScanResult {
  risksCreated: number;
  topicsAnalyzed: number;
  skippedTopics: number;
  errors: string[];
}

async function persistRiskIssue(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    organizationId: string;
    agentRunId: string;
    userId: string;
    risk: RiskFinding;
    topicLabel: string;
  }
) {
  const evidence = normalizeIssueEvidence(params.risk.evidence);
  const score = calculateRiskScore({
    severity: params.risk.severity,
    cost_impact: params.risk.cost_impact,
    schedule_impact: params.risk.schedule_impact,
    compliance_impact: params.risk.compliance_impact,
    confidence: params.risk.confidence,
    evidence_count: evidence.length,
    blocks_work: Boolean(params.risk.blocked_activity),
  });

  const { error } = await supabase.from("issues").insert({
    project_id: params.projectId,
    organization_id: params.organizationId,
    agent_run_id: params.agentRunId,
    issue_type:
      params.risk.risk_category === "drawing_spec_conflict"
        ? "drawing_spec_conflict"
        : params.risk.risk_category === "missing_information"
          ? "missing_info"
          : params.risk.risk_category === "coordination_conflict"
            ? "coordination"
            : "other",
    severity: params.risk.severity,
    status: params.risk.draft_rfi ? "draft_rfi" : "open",
    summary: params.risk.summary,
    description: params.risk.description,
    evidence,
    draft_rfi: params.risk.draft_rfi ?? null,
    confidence: params.risk.confidence,
    trade: params.risk.responsible_trade ?? null,
    recommended_action: params.risk.recommended_action,
    created_by: params.userId,
    risk_category: params.risk.risk_category,
    risk_score: score.risk_score,
    risk_tier: score.risk_tier,
    cost_impact: params.risk.cost_impact,
    schedule_impact: params.risk.schedule_impact,
    compliance_impact: params.risk.compliance_impact,
    responsible_party: params.risk.responsible_party ?? null,
    responsible_trade: params.risk.responsible_trade ?? null,
    spec_section: params.risk.spec_section ?? null,
    drawing_sheet: params.risk.drawing_sheet ?? null,
    required_artifact: params.risk.required_artifact,
    blocked_activity: params.risk.blocked_activity ?? null,
    risk_reasoning: `Detected during Risk Scan (${params.topicLabel}). ${params.risk.description}`,
    evidence_strength: params.risk.evidence_strength,
  });

  if (error) throw new RiskScanError(error.message, "db_error");
}
```

The rest of `runRiskScan()` should mirror `runRfiScan()`:

- mark `agent_runs.status` as `running`;
- verify ready documents exist;
- call `retrieveTopicChunkGroups()`;
- loop groups with `analyzeRiskTopicGroup()`;
- persist each returned risk with `persistRiskIssue()`;
- mark agent run `completed` with `risks_created`, `topics_analyzed`, `skipped_topics`, and `errors`;
- mark failed runs with `failRiskAgentRun()`.

Create `apps/web/app/api/projects/[projectId]/agents/risk-scan/route.ts` by adapting the RFI scan route:

```ts
import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { failRiskAgentRun, runRiskScan, RiskScanError } from "@/lib/agents/risk/runner";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { user, project, supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured" }, { status: 500 });
  }

  const { data: running } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("project_id", projectId)
    .eq("agent_type", "risk_agent")
    .eq("status", "running")
    .maybeSingle();

  if (running) {
    return NextResponse.json(
      { error: "A risk scan is already running for this project.", agent_run_id: running.id },
      { status: 409 }
    );
  }

  const { data: agentRun, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      project_id: projectId,
      organization_id: project!.organization_id,
      agent_type: "risk_agent",
      status: "running",
      input_params: { mode: "risk_register_scan" },
      triggered_by: user!.id,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (runError || !agentRun) {
    return NextResponse.json(
      { error: runError?.message ?? "Failed to create agent run" },
      { status: 500 }
    );
  }

  after(async () => {
    try {
      await runRiskScan({
        supabase,
        projectId,
        organizationId: project!.organization_id,
        agentRunId: agentRun.id,
        userId: user!.id,
      });
    } catch (err) {
      const scanError =
        err instanceof RiskScanError
          ? err
          : new RiskScanError(err instanceof Error ? err.message : "Risk scan failed", "db_error");
      await failRiskAgentRun(supabase, agentRun.id, scanError);
    }
  });

  return NextResponse.json({ agent_run_id: agentRun.id, status: "running" }, { status: 202 });
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test --workspace=web -- lib/agents/risk/schema.test.ts lib/risks/scoring.test.ts
npm run lint
npm run build
```

Expected: PASS.

Commit:

```bash
git add apps/web/lib/agents/risk 'apps/web/app/api/projects/[projectId]/agents/risk-scan/route.ts'
git commit -m "Add AI risk scan agent"
```

---

### Task 5: Risk Register Page, Filters, and CSV Export

**Files:**

- Create: `apps/web/app/(dashboard)/projects/[projectId]/risks/page.tsx`
- Create: `apps/web/components/agents/risk-scan-button.tsx`
- Create: `apps/web/components/risks/risk-register.tsx`
- Create: `apps/web/components/risks/risk-card.tsx`
- Modify: `apps/web/components/projects/project-tabs.tsx`

- [ ] **Step 1: Add Risks tab**

Modify `apps/web/components/projects/project-tabs.tsx`:

```ts
const tabs = [
  { href: base, label: "Overview", exact: true },
  { href: `${base}/documents`, label: "Documents", exact: false },
  { href: `${base}/chat`, label: "Chat", exact: false },
  { href: `${base}/risks`, label: "Risks", exact: false },
  { href: `${base}/issues`, label: "RFIs", exact: false },
  { href: `${base}/submittals`, label: "Submittals", exact: false },
];
```

- [ ] **Step 2: Add risk scan button**

Create `apps/web/components/agents/risk-scan-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RiskScanButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/agents/risk-scan`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to start risk scan");
      setMessage("Risk scan started. Refresh in a moment to see new findings.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start risk scan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={runScan} disabled={loading} className="gap-2">
        <AlertTriangle className="h-4 w-4" />
        {loading ? "Scanning..." : "Run Risk Scan"}
      </Button>
      {message && <p className="text-xs text-green-700">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Add risk card**

Create `apps/web/components/risks/risk-card.tsx`:

```tsx
import type { Issue } from "@/lib/types/database";
import { Card } from "@/components/ui/card";
import { SourceViewer } from "@/components/documents/source-viewer";

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Not set";
}

export function RiskCard({ projectId, risk }: { projectId: string; risk: Issue }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            {label(risk.risk_tier)} risk
          </p>
          <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {risk.summary}
          </h3>
          {risk.description && (
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {risk.description}
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
            Score {risk.risk_score ?? "—"}
          </p>
          <p className="text-xs text-zinc-500">
            {risk.confidence != null ? `${Math.round(risk.confidence * 100)}% confidence` : "Confidence not set"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">Cost</p>
          <p className="font-medium">{label(risk.cost_impact)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Schedule</p>
          <p className="font-medium">{label(risk.schedule_impact)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Compliance</p>
          <p className="font-medium">{label(risk.compliance_impact)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Responsible</p>
          <p className="font-medium">{risk.responsible_party ?? risk.responsible_trade ?? risk.trade ?? "Not set"}</p>
        </div>
      </div>

      {risk.recommended_action && (
        <p className="mt-4 rounded-md bg-orange-50 p-3 text-sm text-orange-950 dark:bg-orange-950/30 dark:text-orange-100">
          {risk.recommended_action}
        </p>
      )}

      {risk.evidence?.length > 0 && (
        <div className="mt-4 space-y-3">
          {risk.evidence.map((item, index) => (
            <div key={`${item.document_id}-${item.page_number}-${index}`}>
              <p className="text-xs font-medium text-zinc-500">
                {item.document_name ?? "Source"} {item.page_number ? `p.${item.page_number}` : ""}
              </p>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {item.quote ?? item.excerpt}
              </p>
              <SourceViewer projectId={projectId} evidence={item} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Add risk register client component**

Create `apps/web/components/risks/risk-register.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { Issue } from "@/lib/types/database";
import { buildRiskCsv } from "@/lib/risks/export";
import { summarizeRisks } from "@/lib/risks/summary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RiskCard } from "./risk-card";

const all = "all";

export function RiskRegister({ projectId, risks }: { projectId: string; risks: Issue[] }) {
  const [tier, setTier] = useState(all);
  const [compliance, setCompliance] = useState(all);
  const summary = summarizeRisks(risks);

  const filtered = useMemo(
    () =>
      risks.filter((risk) => {
        if (tier !== all && risk.risk_tier !== tier) return false;
        if (compliance !== all && risk.compliance_impact !== compliance) return false;
        return true;
      }),
    [risks, tier, compliance]
  );

  function exportCsv() {
    const blob = new Blob([buildRiskCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "risk-register.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Open risks", summary.open],
          ["Critical/high", summary.critical_or_high],
          ["Compliance exposure", summary.compliance_exposure],
          ["Draft RFIs needed", summary.draft_rfis_needed],
          ["Awaiting review", summary.awaiting_review],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Risk tier
          <select className="mt-1 block rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" value={tier} onChange={(event) => setTier(event.target.value)}>
            <option value={all}>All tiers</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Compliance
          <select className="mt-1 block rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" value={compliance} onChange={(event) => setCompliance(event.target.value)}>
            <option value={all}>All impacts</option>
            <option value="possible_noncompliance">Possible noncompliance</option>
            <option value="spec_deviation">Spec deviation</option>
            <option value="code_or_life_safety">Code or life safety</option>
            <option value="submittal_required">Submittal required</option>
            <option value="owner_approval_required">Owner approval required</option>
            <option value="inspection_or_testing_required">Inspection/testing required</option>
            <option value="closeout_required">Closeout required</option>
            <option value="none">None</option>
          </select>
        </label>
        <Button type="button" variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          Export CSV
        </Button>
      </div>

      {filtered.length > 0 ? (
        filtered.map((risk) => <RiskCard key={risk.id} projectId={projectId} risk={risk} />)
      ) : (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No risks match these filters. Run a Risk Scan or adjust the filters.
          </p>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add risk page**

Create `apps/web/app/(dashboard)/projects/[projectId]/risks/page.tsx`:

```tsx
import { RiskScanButton } from "@/components/agents/risk-scan-button";
import { RiskRegister } from "@/components/risks/risk-register";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types/database";

export default async function ProjectRisksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("project_id", projectId)
    .not("risk_tier", "is", null)
    .order("risk_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            AI Risk Register
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Ranked cost, schedule, and compliance risks with cited project evidence.
          </p>
        </div>
        <RiskScanButton projectId={projectId} />
      </div>

      <RiskRegister projectId={projectId} risks={(data ?? []) as Issue[]} />
    </div>
  );
}
```

- [ ] **Step 6: Run verification and commit**

Run:

```bash
npm test --workspace=web -- lib/risks/summary.test.ts
npm run lint
npm run build
```

Expected: PASS.

Commit:

```bash
git add 'apps/web/app/(dashboard)/projects/[projectId]/risks/page.tsx' apps/web/components/agents/risk-scan-button.tsx apps/web/components/risks apps/web/components/projects/project-tabs.tsx
git commit -m "Add risk register page"
```

---

### Task 6: Dashboard Risk Modules

**Files:**

- Modify: `apps/web/lib/projects/dashboard.ts`
- Modify: `apps/web/lib/projects/dashboard.test.ts`
- Modify: `apps/web/components/projects/project-overview.tsx`

- [ ] **Step 1: Add failing dashboard test**

Append to `apps/web/lib/projects/dashboard.test.ts`:

```ts
test("includes risk summary and top risks in project dashboard data", () => {
  const dashboard = buildProjectDashboard({
    projectId: "project-1",
    documents: [],
    submittals: [],
    agentRuns: [],
    issues: [
      {
        id: "risk-1",
        summary: "Fire door rating missing",
        status: "open",
        risk_tier: "critical",
        risk_score: 92,
        compliance_impact: "code_or_life_safety",
        required_artifact: "rfi",
        rfis: [],
      },
      {
        id: "risk-2",
        summary: "Hardware submittal required",
        status: "draft_rfi",
        risk_tier: "high",
        risk_score: 70,
        compliance_impact: "submittal_required",
        required_artifact: "submittal",
        rfis: [{ status: "draft" }],
      },
      {
        id: "issue-1",
        summary: "Plain issue",
        status: "open",
        risk_tier: null,
        risk_score: null,
        compliance_impact: null,
        required_artifact: null,
        rfis: [],
      },
    ],
  });

  expect(dashboard.riskSummary.open).toBe(2);
  expect(dashboard.riskSummary.compliance_exposure).toBe(2);
  expect(dashboard.topRisks.map((risk) => risk.id)).toEqual(["risk-1", "risk-2"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test --workspace=web -- lib/projects/dashboard.test.ts
```

Expected: FAIL because `riskSummary` and `topRisks` are not returned.

- [ ] **Step 3: Extend dashboard helper**

Modify `apps/web/lib/projects/dashboard.ts`:

```ts
import { summarizeRisks, type RiskSummary } from "../risks/summary";
```

Add fields to `ProjectDashboardData`:

```ts
  riskSummary: RiskSummary;
  topRisks: TIssue[];
```

In `buildProjectDashboard()`:

```ts
const riskIssues = issues.filter((issue) => issue.risk_tier);

return {
  projectId,
  documents,
  issues,
  submittals,
  agentRuns,
  documentSummary: summarizeDocuments(documents),
  issueSummary: summarizeIssueWorkflows(issues),
  submittalSummary: summarizeSubmittals(submittals),
  riskSummary: summarizeRisks(riskIssues),
  topRisks: [...riskIssues]
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .slice(0, 3),
  recentDocuments: documents.slice(0, 3),
  recentIssues: issues.slice(0, 3),
  recentSubmittals: submittals.slice(0, 3),
};
```

- [ ] **Step 4: Add dashboard UI modules**

Modify `apps/web/components/projects/project-overview.tsx`:

Add `riskSummary` and `topRisks` to the destructuring:

```ts
    riskSummary,
    topRisks,
```

Add a new section after RFI workflow:

```tsx
      <section>
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Risk exposure
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Open risks" value={riskSummary.open} />
          <StatCard label="Critical/high" value={riskSummary.critical_or_high} />
          <StatCard label="Compliance" value={riskSummary.compliance_exposure} />
          <StatCard label="Draft RFIs" value={riskSummary.draft_rfis_needed} />
          <StatCard label="Awaiting review" value={riskSummary.awaiting_review} />
        </div>
      </section>
```

Add a Top Risks card near recent activity:

```tsx
      {topRisks.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top risks</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {topRisks.map((risk) => (
              <Link
                key={risk.id}
                href={`/projects/${projectId}/risks`}
                className="rounded-lg border border-zinc-200 p-3 text-sm transition hover:border-orange-300 dark:border-zinc-800"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                  {risk.risk_tier} · score {risk.risk_score ?? "—"}
                </p>
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {risk.summary}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      )}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test --workspace=web -- lib/projects/dashboard.test.ts lib/risks/summary.test.ts
npm run lint
npm run build
```

Expected: PASS.

Commit:

```bash
git add apps/web/lib/projects/dashboard.ts apps/web/lib/projects/dashboard.test.ts apps/web/components/projects/project-overview.tsx
git commit -m "Add risk summaries to dashboard"
```

---

### Task 7: Final Verification and Manual Smoke Test

**Files:**

- No planned source edits.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm test --workspace=web
npm run lint
npm run build
git diff --check
```

Expected:

- Vitest reports all tests passing.
- ESLint exits 0.
- Next build exits 0.
- `git diff --check` prints no whitespace errors.

- [ ] **Step 2: Run local app**

Run:

```bash
npm run dev --workspace=web -- --hostname 127.0.0.1 --port 3000
```

Expected:

- Server starts on `http://127.0.0.1:3000`.
- Output shows `Environments: .env.local`.

- [ ] **Step 3: Browser smoke test**

In the browser:

- Visit `http://127.0.0.1:3000/login`.
- Confirm the login page renders.
- If signed in, visit a real project and open the Risks tab.
- Confirm `/projects/:projectId/risks` renders the Risk Register shell.
- Confirm filters render.
- Confirm Export CSV button is disabled when no risks are present.
- Confirm Run Risk Scan button is visible.

- [ ] **Step 4: Stop dev server**

Stop the dev server with `Ctrl-C`.

- [ ] **Step 5: Commit final fixes if any were needed**

If Step 1-3 required fixes:

```bash
git status --short
git add apps/web/lib/risks apps/web/lib/agents/risk apps/web/components/risks apps/web/components/agents/risk-scan-button.tsx apps/web/components/projects/project-overview.tsx apps/web/components/projects/project-tabs.tsx 'apps/web/app/(dashboard)/projects/[projectId]/risks/page.tsx' 'apps/web/app/api/projects/[projectId]/agents/risk-scan/route.ts' 'apps/web/app/api/projects/[projectId]/risks/route.ts' 'apps/web/app/api/projects/[projectId]/issues/[issueId]/route.ts' apps/web/lib/projects/dashboard.ts apps/web/lib/projects/dashboard.test.ts apps/web/lib/types/database.ts supabase/migrations/008_ai_risk_register.sql
git commit -m "Polish AI risk register"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Notes

Spec coverage:

- Ranked risk log: Tasks 1, 5, 6.
- Cost/schedule/compliance impact: Tasks 1, 2, 4, 5.
- Responsible trade/party: Tasks 2, 4, 5.
- Confidence and evidence: Tasks 4, 5.
- Draft RFI path: Task 4 persists `draft_rfi`; existing issue workflow remains available.
- Compliance expansion hooks: Tasks 1 and 2 add compliance impact, required artifact, spec section, drawing sheet, and evidence strength.
- Dashboard top risks and compliance exposure: Task 6.
- CSV export: Tasks 1 and 5.
- Guardrails against evidence-free AI findings: Task 4 schema and prompt.

Known implementation constraints:

- Supabase CLI is not required by this plan because prior work in this repo has used checked-in migrations and app-level build verification. Apply migrations in the target Supabase project before exercising risk scans against live data.
- The first UI version filters client-side after loading risk issues. That is acceptable for MVP project sizes and keeps the first slice simple.
- Direct Procore/Autodesk sync remains outside this plan.
