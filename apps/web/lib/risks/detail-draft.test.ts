import { describe, expect, test } from "vitest";
import type { Issue } from "@/lib/types/database";
import { buildRiskMetadataDraft, buildRiskMetadataPayload } from "./detail-draft";

const baseIssue = {
  risk_category: "possible_spec_deviation",
  risk_score: 82,
  risk_tier: "high",
  cost_impact: "medium",
  schedule_impact: "high",
  compliance_impact: "spec_deviation",
  responsible_party: "Architect",
  responsible_trade: "doors",
  spec_section: "08 11 13",
  drawing_sheet: "A601",
  required_artifact: "rfi",
  blocked_activity: "Door release",
  risk_reasoning: "Spec and drawing conflict.",
  evidence_strength: "strong",
} as Issue;

describe("risk detail draft", () => {
  test("builds an editable risk metadata draft from an issue", () => {
    expect(buildRiskMetadataDraft(baseIssue)).toEqual({
      risk_category: "possible_spec_deviation",
      risk_score: "82",
      risk_tier: "high",
      cost_impact: "medium",
      schedule_impact: "high",
      compliance_impact: "spec_deviation",
      responsible_party: "Architect",
      responsible_trade: "doors",
      spec_section: "08 11 13",
      drawing_sheet: "A601",
      required_artifact: "rfi",
      blocked_activity: "Door release",
      risk_reasoning: "Spec and drawing conflict.",
      evidence_strength: "strong",
    });
  });

  test("normalizes editable risk metadata into an API payload", () => {
    expect(
      buildRiskMetadataPayload({
        risk_category: "",
        risk_score: "  ",
        risk_tier: "critical",
        cost_impact: "",
        schedule_impact: "medium",
        compliance_impact: "inspection_or_testing_required",
        responsible_party: " GC ",
        responsible_trade: "",
        spec_section: " 01 45 00 ",
        drawing_sheet: "",
        required_artifact: "inspection",
        blocked_activity: " ",
        risk_reasoning: " Needs inspection before cover-up. ",
        evidence_strength: "",
      })
    ).toEqual({
      risk_category: null,
      risk_score: null,
      risk_tier: "critical",
      cost_impact: null,
      schedule_impact: "medium",
      compliance_impact: "inspection_or_testing_required",
      responsible_party: "GC",
      responsible_trade: null,
      spec_section: "01 45 00",
      drawing_sheet: null,
      required_artifact: "inspection",
      blocked_activity: null,
      risk_reasoning: "Needs inspection before cover-up.",
      evidence_strength: null,
    });
  });
});
