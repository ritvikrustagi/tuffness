import { describe, expect, test } from "vitest";
import { buildRiskCsv } from "./export";
import { summarizeRisks } from "./summary";
import type { RiskLike } from "./types";

const sampleRisks = [
  {
    id: "risk-1",
    summary: 'Door rating "gap"',
    status: "open",
    risk_tier: "critical",
    risk_category: "drawing_spec_conflict",
    cost_impact: "none",
    schedule_impact: "low",
    compliance_impact: "code_or_life_safety",
    trade: "=Doors",
    responsible_party: "+Architect",
    spec_section: "08 11 00",
    drawing_sheet: "A601",
    required_artifact: "rfi",
    confidence: 0.95,
    recommended_action: "Draft RFI for rated door clarification.",
    evidence: [
      {
        document_name: "A601",
        page_number: 12,
        quote: "Door rating not shown.",
      },
    ],
  },
  {
    id: "risk-2",
    summary: "Submittal missing",
    status: "acknowledged",
    risk_tier: "high",
    risk_category: "submittal_requirement",
    cost_impact: "low",
    schedule_impact: "medium",
    compliance_impact: "submittal_required",
    trade: "Glazing",
    responsible_party: "GC",
    spec_section: "08 80 00",
    drawing_sheet: null,
    required_artifact: "submittal",
    confidence: 0.8,
    recommended_action: "Request missing submittal.",
    evidence: [],
  },
  {
    id: "risk-3",
    summary: "Closed coordination note",
    status: "resolved",
    risk_tier: "medium",
    risk_category: "coordination_conflict",
    cost_impact: "none",
    schedule_impact: "none",
    compliance_impact: "none",
    trade: null,
    responsible_party: null,
    spec_section: null,
    drawing_sheet: null,
    required_artifact: "none",
    confidence: 0.7,
    recommended_action: null,
    evidence: [],
  },
  {
    id: "reviewed:risk-4",
    summary: "Reviewed owner approval",
    status: "acknowledged",
    risk_tier: "medium",
    risk_category: "owner_design_approval",
    cost_impact: "none",
    schedule_impact: "low",
    compliance_impact: "owner_approval_required",
    trade: "Millwork",
    responsible_party: "Owner",
    spec_section: null,
    drawing_sheet: "A901",
    required_artifact: "owner_approval",
    confidence: 0.65,
    recommended_action: "Track owner approval.",
    evidence: [],
  },
] satisfies RiskLike[];

describe("risk summaries", () => {
  test("summarizeRisks returns dashboard counters", () => {
    expect(summarizeRisks(sampleRisks)).toEqual({
      total: 4,
      open: 3,
      critical_or_high: 2,
      compliance_exposure: 3,
      draft_rfis_needed: 1,
      awaiting_review: 2,
      closed: 1,
    });
  });

  test("reviewed non-closed risks do not count as awaiting review", () => {
    expect(summarizeRisks(sampleRisks).awaiting_review).toBe(2);
  });

  test("buildRiskCsv emits header, quoted critical row, and evidence text", () => {
    const csv = buildRiskCsv(sampleRisks);

    expect(csv).toContain(
      '"Risk Tier","Summary","Risk Category","Cost Impact","Schedule Impact","Compliance Impact","Trade","Responsible Party","Spec Section","Drawing Sheet","Required Artifact","Confidence","Workflow State","Recommended Action","Evidence References"'
    );
    expect(csv).toContain(
      '"critical","Door rating ""gap""","drawing_spec_conflict","none","low","code_or_life_safety"'
    );
    expect(csv).toContain("A601 p.12: Door rating not shown.");
  });

  test("buildRiskCsv neutralizes formula-like values before quoting", () => {
    const csv = buildRiskCsv(sampleRisks);

    expect(csv).toContain(`"'=Doors"`);
    expect(csv).toContain(`"'+Architect"`);
  });
});
