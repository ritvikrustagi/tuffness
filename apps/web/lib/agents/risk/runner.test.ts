import { describe, expect, test } from "vitest";
import type { RiskFinding } from "./schema";
import {
  buildRiskRunSummary,
  createRiskDedupeKey,
  type RiskTopicError,
} from "./runner";

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
      errors: ["Doors: unsupported evidence for Door rating mismatch"],
      code: "validation_failed",
    });
  });
});
