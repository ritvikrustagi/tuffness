import { describe, expect, test } from "vitest";
import { calculateRiskScore, getRiskTier } from "./scoring";

describe("risk scoring", () => {
  test("code_or_life_safety ranks critical even with no cost impact", () => {
    const score = calculateRiskScore({
      category: "code_or_life_safety",
      schedule_impact: "minor",
      cost_impact: "none",
      compliance_impact: "code",
      confidence: 0.95,
    });

    expect(getRiskTier(score)).toBe("critical");
  });

  test("weak confidence still keeps critical schedule blocker high but below critical", () => {
    const score = calculateRiskScore({
      category: "schedule",
      schedule_impact: "critical",
      cost_impact: "minor",
      compliance_impact: "none",
      confidence: 0.25,
    });

    expect(getRiskTier(score)).toBe("high");
    expect(score).toBeLessThan(90);
  });

  test("getRiskTier maps thresholds", () => {
    expect(getRiskTier(90)).toBe("critical");
    expect(getRiskTier(70)).toBe("high");
    expect(getRiskTier(45)).toBe("medium");
    expect(getRiskTier(10)).toBe("low");
  });
});
