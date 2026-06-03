import { describe, expect, test } from "vitest";
import { buildRiskCsv } from "./export";
import { summarizeRisks } from "./summary";
import type { RiskLike } from "./types";

const sampleRisks = [
  {
    id: "risk-1",
    title: 'Door rating "gap"',
    status: "open",
    tier: "critical",
    category: "code_or_life_safety",
    compliance_impact: "code",
    required_artifact: "rfi",
    evidence: [
      {
        document_name: "A601",
        page_number: 12,
        text: "Door rating not shown.",
      },
    ],
  },
  {
    id: "risk-2",
    title: "Submittal missing",
    status: "under_review",
    tier: "high",
    category: "compliance",
    compliance_impact: "specification",
    required_artifact: "submittal",
    evidence: [],
  },
  {
    id: "risk-3",
    title: "Closed coordination note",
    status: "resolved",
    tier: "medium",
    category: "coordination",
    compliance_impact: "none",
    required_artifact: "none",
    evidence: [],
  },
] satisfies RiskLike[];

describe("risk summaries", () => {
  test("summarizeRisks returns dashboard counters", () => {
    expect(summarizeRisks(sampleRisks)).toEqual({
      total: 3,
      open: 2,
      critical_or_high: 2,
      compliance_exposure: 2,
      draft_rfis_needed: 1,
      awaiting_review: 2,
      closed: 1,
    });
  });

  test("buildRiskCsv emits header, quoted critical row, and evidence text", () => {
    const csv = buildRiskCsv(sampleRisks);

    expect(csv).toContain(
      '"id","title","status","tier","category","compliance_impact","required_artifact","evidence"'
    );
    expect(csv).toContain(
      '"risk-1","Door rating ""gap""","open","critical","code_or_life_safety","code","rfi"'
    );
    expect(csv).toContain("A601 p.12: Door rating not shown.");
  });
});
