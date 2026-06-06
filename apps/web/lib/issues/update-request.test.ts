import { describe, expect, test } from "vitest";
import { parseIssueUpdateRequest, safeParseIssueUpdateRequest } from "./update-request";

describe("issue update request parsing", () => {
  test("separates workflow, risk metadata, and review commands", () => {
    const parsed = parseIssueUpdateRequest({
      workflow_state: "draft_rfi",
      draft_rfi: "Confirm door rating.",
      risk_tier: "high",
      responsible_party: "Architect",
      mark_reviewed: true,
    });

    expect(parsed.workflowPatch).toEqual({
      workflow_state: "draft_rfi",
      draft_rfi: "Confirm door rating.",
    });
    expect(parsed.riskPatch).toEqual({
      risk_tier: "high",
      responsible_party: "Architect",
    });
    expect(parsed.markReviewed).toBe(true);
    expect(parsed.hasWorkflowFields).toBe(true);
    expect(parsed.hasRiskPatch).toBe(true);
  });

  test("keeps review commands out of risk metadata", () => {
    const parsed = parseIssueUpdateRequest({ mark_reviewed: true });

    expect(parsed.workflowPatch).toEqual({});
    expect(parsed.riskPatch).toEqual({});
    expect(parsed.markReviewed).toBe(true);
    expect(parsed.hasWorkflowFields).toBe(false);
    expect(parsed.hasRiskPatch).toBe(false);
  });

  test("safe parsing returns separated patches without a second parse step", () => {
    const parsed = safeParseIssueUpdateRequest({
      workflow_state: "acknowledged",
      mark_reviewed: true,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("expected successful parse");
    expect(parsed.data.workflowPatch).toEqual({ workflow_state: "acknowledged" });
    expect(parsed.data.riskPatch).toEqual({});
    expect(parsed.data.markReviewed).toBe(true);
    expect(parsed.data.hasAnyPatch).toBe(true);
  });
});
