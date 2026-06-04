import { describe, expect, test } from "vitest";
import { filterRiskRegisterRisks, type RiskRegisterFilters } from "./register";
import type { RiskLike } from "./types";

const risks = [
  {
    id: "risk-1",
    summary: "General coordination issue",
    risk_tier: "medium",
    compliance_impact: "none",
    required_artifact: "none",
  },
  {
    id: "risk-2",
    summary: "Submittal requirement",
    risk_tier: "high",
    compliance_impact: "submittal_required",
    required_artifact: "submittal",
  },
  {
    id: "risk-3",
    summary: "Owner approval requirement",
    risk_tier: "low",
    compliance_impact: "owner_approval_required",
    required_artifact: "owner_approval",
  },
] satisfies RiskLike[];

const baseFilters: RiskRegisterFilters = {
  view: "all",
  tierFilter: "all",
  complianceFilter: "all",
  artifactFilter: "all",
  groupFilter: "all",
};

describe("risk register filtering", () => {
  test("ignores hidden compliance-only filters in the all-risks view", () => {
    const filtered = filterRiskRegisterRisks(risks, {
      ...baseFilters,
      artifactFilter: "submittal",
      groupFilter: "submittal_required",
    });

    expect(filtered.map((risk) => risk.id)).toEqual(["risk-1", "risk-2", "risk-3"]);
  });

  test("applies compliance-only filters in the compliance view", () => {
    const filtered = filterRiskRegisterRisks(risks, {
      ...baseFilters,
      view: "compliance",
      artifactFilter: "submittal",
      groupFilter: "submittal_required",
    });

    expect(filtered.map((risk) => risk.id)).toEqual(["risk-2"]);
  });
});
