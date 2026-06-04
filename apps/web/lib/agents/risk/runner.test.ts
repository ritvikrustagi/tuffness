import { describe, expect, test } from "vitest";
import type { RiskFinding } from "./schema";
import type { MatchedChunk } from "@/lib/rag/types";
import {
  buildRiskRunSummary,
  createRiskDedupeKey,
  failRiskAgentRun,
  RiskScanError,
  type RiskTopicError,
} from "./runner";
import { selectPersistableRiskFindings } from "./selection";

const baseRisk: RiskFinding = {
  risk_category: "possible_spec_deviation",
  severity: "high",
  cost_impact: "medium",
  schedule_impact: "high",
  compliance_impact: "spec_deviation",
  required_artifact: "none",
  summary: "Door rating mismatch",
  description: "Door schedule and specifications do not align.",
  evidence: [
    {
      document_id: "11111111-1111-4111-8111-111111111111",
      document_name: "Drawings",
      page_number: 4,
      quote: "Door 101 rating not indicated",
    },
    {
      document_id: "22222222-2222-4222-8222-222222222222",
      document_name: "Specifications",
      page_number: 18,
      quote: "Rated door frames required",
    },
  ],
  confidence: 0.8,
  evidence_strength: "strong",
  recommended_action: "Review with the architect.",
};

describe("risk scan runner helpers", () => {
  test("dedupes by normalized full evidence set regardless of order", () => {
    const reorderedRisk = {
      ...baseRisk,
      evidence: [baseRisk.evidence[1], baseRisk.evidence[0]],
    };

    expect(createRiskDedupeKey(baseRisk)).toBe(createRiskDedupeKey(reorderedRisk));
  });

  test("dedupe key changes when any evidence item changes", () => {
    const changedRisk = {
      ...baseRisk,
      evidence: [
        baseRisk.evidence[0],
        {
          ...baseRisk.evidence[1],
          quote: "Different rated frame requirement",
        },
      ],
    };

    expect(createRiskDedupeKey(baseRisk)).not.toBe(createRiskDedupeKey(changedRisk));
  });

  test("failed run summary preserves counts, errors, and code", () => {
    const errors: RiskTopicError[] = [
      {
        topicLabel: "Doors",
        message: "unsupported evidence for Door rating mismatch",
        code: "validation_failed",
      },
    ];

    expect(
      buildRiskRunSummary({
        mode: "compliance_register_scan",
        risksCreated: 0,
        rfisCreated: 0,
        topicsAnalyzed: 1,
        skippedTopics: 0,
        errors,
        code: "validation_failed",
      })
    ).toEqual({
      risks_created: 0,
      rfis_created: 0,
      topics_analyzed: 1,
      skipped_topics: 0,
      mode: "compliance_register_scan",
      errors: ["Doors: unsupported evidence for Door rating mismatch"],
      code: "validation_failed",
    });
  });

  test("selectPersistableRiskFindings filters unsupported evidence, dedupes, and enforces cap", () => {
    const riskKeys = new Set<string>();
    const chunks = [
      {
        id: "chunk-1",
        document_id: "11111111-1111-4111-8111-111111111111",
        document_page_id: "page-1",
        document_name: "Drawings",
        page_number: 4,
        content: "Door 101 rating not indicated",
        content_type: "text",
        metadata: {},
        similarity: 0.9,
        sheet_number: null,
        sheet_title: null,
      },
    ] satisfies MatchedChunk[];

    const duplicateRisk = { ...baseRisk, evidence: [baseRisk.evidence[0]] };
    const unsupportedRisk = {
      ...baseRisk,
      summary: "Unsupported claim",
      evidence: [
        {
          ...baseRisk.evidence[0],
          quote: "This quote is not in the chunk",
        },
      ],
    };

    const result = selectPersistableRiskFindings({
      topicLabel: "Doors",
      chunks,
      risks: [duplicateRisk, duplicateRisk, unsupportedRisk],
      riskKeys,
      remainingSlots: 1,
    });

    expect(result.risks).toEqual([duplicateRisk]);
    expect(riskKeys.size).toBe(0);
    expect(result.dedupeKeys).toEqual([createRiskDedupeKey(duplicateRisk)]);
    expect(result.errors).toEqual([
      {
        topicLabel: "Doors",
        message: "risk cap reached; skipped remaining findings after 1 risks",
        code: "validation_failed",
      },
    ]);
  });

  test("failRiskAgentRun writes default summary shape for plain scan errors", async () => {
    let patch: Record<string, unknown> | null = null;
    const supabase = {
      from: (table: string) => {
        expect(table).toBe("agent_runs");
        return {
          update: (value: Record<string, unknown>) => {
            patch = value;
            return {
              eq: async (column: string, value: string) => {
                expect(column).toBe("id");
                expect(value).toBe("run-1");
                return { error: null };
              },
            };
          },
        };
      },
    };

    await failRiskAgentRun(
      supabase as never,
      "run-1",
      new RiskScanError("No processed documents available for this project.", "no_documents")
    );

    expect(patch?.output_summary).toEqual({
      mode: "risk_register_scan",
      risks_created: 0,
      rfis_created: 0,
      topics_analyzed: 0,
      skipped_topics: 0,
      errors: ["No processed documents available for this project."],
      code: "no_documents",
    });
  });
});
