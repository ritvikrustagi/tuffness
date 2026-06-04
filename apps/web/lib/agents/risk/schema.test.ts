import { describe, expect, test } from "vitest";
import { riskAgentOutputSchema } from "./schema";

const evidenceBackedFinding = {
  risk_category: "possible_spec_deviation",
  severity: "high",
  cost_impact: "medium",
  schedule_impact: "high",
  compliance_impact: "code_or_life_safety",
  responsible_party: "Architect",
  responsible_trade: "doors/hardware",
  spec_section: "08 11 13",
  drawing_sheet: "A601",
  required_artifact: "rfi",
  blocked_activity: "Door frame release",
  summary: "Door frame fire rating may deviate from the specification.",
  description:
    "The door schedule excerpt omits the required fire-rated frame information while the specification excerpt requires rated hollow metal frames for this opening.",
  evidence: [
    {
      document_id: "11111111-1111-4111-8111-111111111111",
      document_name: "Architectural Drawings",
      page_number: 12,
      quote: "Door A601-101 frame type HM-1, rating: not indicated.",
    },
    {
      document_id: "22222222-2222-4222-8222-222222222222",
      document_name: "Project Specifications",
      page_number: 87,
      quote: "Section 08 11 13 requires 90-minute rated hollow metal frames at fire partitions.",
    },
  ],
  draft_rfi:
    "Please confirm whether Door A601-101 requires a 90-minute rated hollow metal frame per Specification Section 08 11 13, and advise how the door schedule should be updated.",
  confidence: 0.86,
  evidence_strength: "strong",
  recommended_action:
    "Review the cited door schedule and specification section, then issue the draft RFI before releasing door frames.",
};

describe("riskAgentOutputSchema", () => {
  test("accepts an evidence-backed risk finding", () => {
    const result = riskAgentOutputSchema.parse({ risks: [evidenceBackedFinding] });

    expect(result.risks[0]).toMatchObject({
      risk_category: "possible_spec_deviation",
      severity: "high",
      cost_impact: "medium",
      schedule_impact: "high",
      compliance_impact: "code_or_life_safety",
      responsible_party: "Architect",
      responsible_trade: "doors/hardware",
      spec_section: "08 11 13",
      drawing_sheet: "A601",
      required_artifact: "rfi",
      blocked_activity: "Door frame release",
      draft_rfi: evidenceBackedFinding.draft_rfi,
      confidence: 0.86,
      evidence_strength: "strong",
      recommended_action: evidenceBackedFinding.recommended_action,
    });
  });

  test("rejects a risk without evidence", () => {
    const result = riskAgentOutputSchema.safeParse({
      risks: [{ ...evidenceBackedFinding, evidence: [] }],
    });

    expect(result.success).toBe(false);
  });
});
