import { describe, expect, test } from "vitest";
import { buildRiskMetadataRpcPatch } from "./patch";
import { riskMetadataPatchSchema } from "./validation";

describe("risk metadata patch", () => {
  test("builds a trimmed risk metadata RPC patch without workflow fields", () => {
    const parsed = riskMetadataPatchSchema.parse({
      risk_category: "possible_spec_deviation",
      risk_score: "76",
      risk_tier: "high",
      compliance_impact: "spec_deviation",
      responsible_party: " Architect ",
      required_artifact: "rfi",
      risk_reasoning: " Spec section and drawing note conflict. ",
    });

    expect(buildRiskMetadataRpcPatch(parsed)).toEqual({
      risk_category: "possible_spec_deviation",
      risk_score: 76,
      risk_tier: "high",
      compliance_impact: "spec_deviation",
      responsible_party: "Architect",
      required_artifact: "rfi",
      risk_reasoning: "Spec section and drawing note conflict.",
    });
  });

  test("includes an explicit reviewed flag in the RPC patch", () => {
    const parsed = riskMetadataPatchSchema.parse({ reviewed: true });

    expect(buildRiskMetadataRpcPatch(parsed)).toEqual({ reviewed: true });
  });
});
