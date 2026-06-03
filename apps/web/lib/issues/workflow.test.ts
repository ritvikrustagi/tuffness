import { describe, expect, test } from "vitest";
import {
  buildDraftRfiPatch,
  getAllowedIssueTransitions,
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
