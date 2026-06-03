import { describe, expect, test } from "vitest";
import {
  buildDraftRfiPatch,
  buildIssueWorkflowPatch,
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

  test("builds a manual external submission patch", () => {
    expect(
      buildDraftRfiPatch({
        status: "submitted_externally",
        external_rfi_number: "RFI-042",
        external_url: "https://example.com/rfis/42",
      })
    ).toEqual({
      status: "submitted_externally",
      external_rfi_number: "RFI-042",
      external_url: "https://example.com/rfis/42",
      submitted_at: expect.any(String),
    });
  });

  test("trims workflow payload fields and preserves clearable nulls", () => {
    expect(
      buildIssueWorkflowPatch({
        status: "draft_rfi",
        rfi_status: "approved",
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
