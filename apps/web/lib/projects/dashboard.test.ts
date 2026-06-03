import { describe, expect, test } from "vitest";
import { summarizeDocuments, summarizeSubmittals } from "./dashboard";

describe("project dashboard summaries", () => {
  test("summarizes document readiness", () => {
    expect(
      summarizeDocuments([
        { status: "ready" },
        { status: "ready" },
        { status: "processing" },
        { status: "pending" },
        { status: "failed" },
      ])
    ).toEqual({
      total: 5,
      ready: 2,
      in_progress: 2,
      failed: 1,
    });
  });

  test("summarizes submittal review state", () => {
    expect(
      summarizeSubmittals([
        { review_status: "pending" },
        { review_status: "pass" },
        { review_status: "warning" },
        { review_status: "fail" },
        { review_status: "warning" },
      ])
    ).toEqual({
      total: 5,
      pending: 1,
      pass: 1,
      warning: 2,
      fail: 1,
    });
  });
});
