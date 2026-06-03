import { describe, expect, test } from "vitest";
import { calculateRiskScore, getRiskTier } from "./scoring";
import { complianceImpacts, impactLevels, requiredArtifacts, riskCategories } from "./types";
import type { Issue } from "../types/database";

describe("risk scoring", () => {
  test("uses planned risk vocabulary", () => {
    expect(riskCategories).toEqual([
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
    ]);
    expect(impactLevels).toEqual(["none", "low", "medium", "high", "critical"]);
    expect(complianceImpacts).toEqual([
      "none",
      "possible_noncompliance",
      "spec_deviation",
      "code_or_life_safety",
      "submittal_required",
      "owner_approval_required",
      "inspection_or_testing_required",
      "closeout_required",
    ]);
    expect(requiredArtifacts).toEqual([
      "none",
      "rfi",
      "submittal",
      "test_report",
      "owner_approval",
      "inspection",
      "closeout_document",
    ]);
  });

  test("code_or_life_safety ranks critical even with no cost impact", () => {
    const result = calculateRiskScore({
      severity: "high",
      schedule_impact: "low",
      cost_impact: "none",
      compliance_impact: "code_or_life_safety",
      confidence: 0.95,
      evidence_count: 1,
      blocks_work: false,
    });

    expect(result.risk_tier).toBe("critical");
  });

  test("weak confidence still keeps critical schedule blocker high but below critical", () => {
    const result = calculateRiskScore({
      severity: "high",
      schedule_impact: "critical",
      cost_impact: "medium",
      compliance_impact: "none",
      confidence: 0.42,
      evidence_count: 1,
      blocks_work: true,
    });

    expect(result.risk_tier).toBe("high");
    expect(result.risk_score).toBeGreaterThanOrEqual(60);
    expect(result.risk_score).toBeLessThan(90);
  });

  test("getRiskTier maps thresholds", () => {
    expect(getRiskTier(85)).toBe("critical");
    expect(getRiskTier(60)).toBe("high");
    expect(getRiskTier(30)).toBe("medium");
    expect(getRiskTier(10)).toBe("low");
  });

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
});
