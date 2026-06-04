import { describe, expect, test } from "vitest";
import {
  buildComplianceItemText,
  getComplianceGroup,
  isComplianceRisk,
  summarizeComplianceRisks,
} from "./compliance";
import type { RiskLike } from "./types";

const complianceRisks = [
  {
    id: "risk-1",
    summary: "Firestopping submittal missing",
    status: "open",
    risk_tier: "high",
    compliance_impact: "submittal_required",
    required_artifact: "submittal",
    spec_section: "07 84 00",
    drawing_sheet: null,
    responsible_party: "GC",
    responsible_trade: "Firestopping",
    confidence: 0.84,
    recommended_action: "Create a submittal tracking item.",
    evidence: [
      {
        document_name: "Project Manual",
        page_number: 312,
        quote: "Submit product data and installer qualifications.",
      },
    ],
  },
  {
    id: "risk-2",
    summary: "Concrete testing required",
    status: "acknowledged",
    risk_tier: "medium",
    compliance_impact: "inspection_or_testing_required",
    required_artifact: "test_report",
    spec_section: "03 30 00",
    responsible_party: "Testing agency",
    responsible_trade: "Concrete",
    confidence: 0.78,
    evidence: [],
  },
  {
    id: "risk-3",
    summary: "Owner finish approval",
    status: "resolved",
    risk_tier: "low",
    compliance_impact: "owner_approval_required",
    required_artifact: "owner_approval",
    drawing_sheet: "A901",
    responsible_party: "Owner",
    confidence: 0.71,
    human_reviewed_at: "2026-06-04T12:00:00.000Z",
    evidence: [],
  },
  {
    id: "risk-4",
    summary: "General coordination risk",
    status: "open",
    risk_tier: "medium",
    compliance_impact: "none",
    required_artifact: "none",
    confidence: 0.8,
    evidence: [],
  },
] satisfies RiskLike[];

describe("compliance register helpers", () => {
  test("derives the primary compliance group from required artifact first", () => {
    expect(getComplianceGroup(complianceRisks[0])).toBe("submittal_required");
    expect(getComplianceGroup(complianceRisks[1])).toBe("inspection_or_testing_required");
    expect(getComplianceGroup(complianceRisks[2])).toBe("owner_approval_required");
    expect(
      getComplianceGroup({
        compliance_impact: "spec_deviation",
        required_artifact: "none",
      })
    ).toBe("possible_spec_deviation");
  });

  test("includes only risks with compliance impact or required artifact", () => {
    expect(complianceRisks.map(isComplianceRisk)).toEqual([true, true, true, false]);
  });

  test("summarizes open compliance work by artifact group", () => {
    expect(summarizeComplianceRisks(complianceRisks)).toEqual({
      total: 3,
      open: 2,
      high_impact: 1,
      rfi_needed: 0,
      submittals_required: 1,
      inspection_or_testing_required: 1,
      owner_approvals_required: 0,
      closeout_required: 0,
      awaiting_review: 2,
    });
  });

  test("builds a copy packet with evidence, confidence, and owner", () => {
    expect(buildComplianceItemText(complianceRisks[0])).toContain(
      "Compliance Item: Firestopping submittal missing"
    );
    expect(buildComplianceItemText(complianceRisks[0])).toContain(
      "Required Artifact: submittal"
    );
    expect(buildComplianceItemText(complianceRisks[0])).toContain(
      "Responsible: GC / Firestopping"
    );
    expect(buildComplianceItemText(complianceRisks[0])).toContain("Confidence: 84%");
    expect(buildComplianceItemText(complianceRisks[0])).toContain(
      "1. Project Manual, page 312: Submit product data and installer qualifications."
    );
  });
});
