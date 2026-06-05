import { describe, expect, test } from "vitest";
import { buildOptionalIssueWorkflowRpcPatch } from "./workflow-draft";

describe("issue workflow RPC patching", () => {
  test("returns an empty workflow patch when only risk metadata changed", () => {
    expect(
      buildOptionalIssueWorkflowRpcPatch({
        hasWorkflowFields: false,
        workflow_state: "resolved",
      })
    ).toEqual({});
  });

  test("includes workflow state when workflow fields changed", () => {
    expect(
      buildOptionalIssueWorkflowRpcPatch({
        hasWorkflowFields: true,
        workflow_state: "draft_rfi",
        draft_rfi: "Confirm door rating.",
      })
    ).toEqual({
      workflow_state: "draft_rfi",
      draft_rfi: "Confirm door rating.",
    });
  });
});
