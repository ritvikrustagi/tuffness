import { describe, expect, test } from "vitest";
import { buildProjectDashboard, summarizeDocuments, summarizeSubmittals } from "./dashboard";

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

  test("builds overview summaries and recent activity slices", () => {
    const dashboard = buildProjectDashboard({
      projectId: "project-1",
      documents: [
        { id: "doc-1", name: "A601", document_type: "drawing", status: "ready" },
        { id: "doc-2", name: "Spec 08 71 00", document_type: "spec", status: "processing" },
        { id: "doc-3", name: "Door Submittal", document_type: "submittal", status: "failed" },
        { id: "doc-4", name: "Old Drawing", document_type: "drawing", status: "pending" },
      ],
      issues: [
        { id: "issue-1", summary: "Door conflict", severity: "high", status: "draft_rfi", rfis: [{ status: "approved" }] },
        { id: "issue-2", summary: "Missing detail", severity: "medium", status: "open", rfis: [] },
        { id: "issue-3", summary: "Answered RFI", severity: "low", status: "answered", rfis: [{ status: "answered" }] },
        { id: "issue-4", summary: "Closed RFI", severity: "low", status: "resolved", rfis: [{ status: "closed" }] },
      ],
      submittals: [
        { id: "sub-1", title: "Door hardware", review_status: "warning", spec_section: "08 71 00" },
        { id: "sub-2", title: "Glazing", review_status: "pass", spec_section: null },
        { id: "sub-3", title: "Concrete", review_status: "pending", spec_section: "03 30 00" },
        { id: "sub-4", title: "Steel", review_status: "fail", spec_section: "05 12 00" },
      ],
      agentRuns: [{ id: "run-1" }, { id: "run-2" }],
    });

    expect(dashboard.documentSummary).toEqual({
      total: 4,
      ready: 1,
      in_progress: 2,
      failed: 1,
    });
    expect(dashboard.issueSummary.closed).toBe(1);
    expect(dashboard.submittalSummary.warning).toBe(1);
    expect(dashboard.recentDocuments.map((document) => document.id)).toEqual([
      "doc-1",
      "doc-2",
      "doc-3",
    ]);
    expect(dashboard.recentIssues.map((issue) => issue.id)).toEqual([
      "issue-1",
      "issue-2",
      "issue-3",
    ]);
    expect(dashboard.recentSubmittals.map((submittal) => submittal.id)).toEqual([
      "sub-1",
      "sub-2",
      "sub-3",
    ]);
  });

  test("includes risk summary and top risks in project dashboard data", () => {
    const dashboard = buildProjectDashboard({
      projectId: "project-1",
      documents: [],
      issues: [
        {
          id: "risk-1",
          summary: "Life safety detail conflict",
          severity: "high",
          status: "open",
          rfis: [],
          risk_tier: "critical",
          risk_score: 92,
          compliance_impact: "code_or_life_safety",
          required_artifact: "rfi",
        },
        {
          id: "risk-2",
          summary: "Submittal missing for substitution",
          severity: "medium",
          status: "open",
          rfis: [],
          risk_tier: "high",
          risk_score: 70,
          compliance_impact: "submittal_required",
          required_artifact: "submittal",
        },
        {
          id: "issue-1",
          summary: "General coordination item",
          severity: "low",
          status: "open",
          rfis: [],
        },
      ],
      submittals: [],
      agentRuns: [],
    });

    expect(dashboard.riskSummary.open).toBe(2);
    expect(dashboard.riskSummary.compliance_exposure).toBe(2);
    expect(dashboard.topRisks.map((risk) => risk.id)).toEqual(["risk-1", "risk-2"]);
  });
});
