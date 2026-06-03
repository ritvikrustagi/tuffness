import { describe, expect, test } from "vitest";
import {
  buildIssueWorkflowPatch,
  deriveWorkflowState,
  getAllowedIssueTransitions,
  getInitialIssueWorkflowDraft,
  isIssueTransitionAllowed,
  normalizeIssueEvidence,
} from "./workflow";

describe("RFI issue workflow", () => {
  test("allows draft RFI lifecycle statuses from an open issue", () => {
    expect(getAllowedIssueTransitions("open")).toEqual([
      "acknowledged",
      "draft_rfi",
      "resolved",
      "dismissed",
    ]);
  });

  test("rejects issue status jumps that skip the workflow", () => {
    expect(isIssueTransitionAllowed("open", "answered")).toBe(false);
    expect(isIssueTransitionAllowed("open", "draft_rfi")).toBe(true);
    expect(isIssueTransitionAllowed("resolved", "open")).toBe(true);
  });

  test("derives editable workflow draft from the issue and linked RFI", () => {
    expect(
      getInitialIssueWorkflowDraft({
        issue: {
          status: "draft_rfi",
          trade: "doors",
          due_date: "2026-06-12",
          discipline: null,
          resolution_notes: null,
          external_system_url: null,
          draft_rfi: "Issue draft",
        },
        rfi: {
          status: "needs_edit",
          external_rfi_number: "RFI-007",
          external_url: "https://example.com/rfis/7",
          question: "Linked RFI question",
          response: null,
        },
      })
    ).toEqual({
      workflow_state: "needs_edit",
      status: "draft_rfi",
      rfi_status: "needs_edit",
      trade: "doors",
      discipline: "",
      due_date: "2026-06-12",
      external_system_url: "",
      external_rfi_number: "RFI-007",
      external_url: "https://example.com/rfis/7",
      response: "",
      resolution_notes: "",
      draft_rfi: "Linked RFI question",
    });
  });

  test("derives one workflow state from issue and RFI statuses", () => {
    expect(deriveWorkflowState({ issueStatus: "open", rfiStatus: null })).toBe("open");
    expect(deriveWorkflowState({ issueStatus: "draft_rfi", rfiStatus: "approved" })).toBe(
      "approved"
    );
    expect(
      deriveWorkflowState({ issueStatus: "submitted", rfiStatus: "submitted_externally" })
    ).toBe("submitted");
    expect(deriveWorkflowState({ issueStatus: "resolved", rfiStatus: "closed" })).toBe(
      "resolved"
    );
  });

  test("trims workflow payload fields and preserves clearable nulls", () => {
    expect(
      buildIssueWorkflowPatch({
        workflow_state: "approved",
        status: "draft_rfi",
        rfi_status: "needs_edit",
        trade: " doors ",
        discipline: "",
        due_date: "2026-06-15",
        external_system_url: " ",
        external_rfi_number: " RFI-042 ",
        external_url: " https://example.com/rfis/42 ",
        response: "",
        resolution_notes: " needs owner response ",
        draft_rfi: " Confirm door hardware set. ",
      })
    ).toEqual({
      workflow_state: "approved",
      status: "draft_rfi",
      rfi_status: "approved",
      trade: "doors",
      discipline: null,
      due_date: "2026-06-15",
      external_system_url: null,
      external_rfi_number: "RFI-042",
      external_url: "https://example.com/rfis/42",
      response: null,
      resolution_notes: "needs owner response",
      draft_rfi: "Confirm door hardware set.",
    });
  });

  test("normalizes agent evidence into quote-backed issue evidence", () => {
    expect(
      normalizeIssueEvidence([
        {
          document_id: "11111111-1111-4111-8111-111111111111",
          document_name: "A601 Door Schedule",
          page_number: 12,
          quote: "Door 101 hardware set is omitted.",
        },
      ])
    ).toEqual([
      {
        document_id: "11111111-1111-4111-8111-111111111111",
        document_name: "A601 Door Schedule",
        page_number: 12,
        excerpt: "Door 101 hardware set is omitted.",
        quote: "Door 101 hardware set is omitted.",
      },
    ]);
  });
});
