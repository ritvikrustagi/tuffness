import { describe, expect, it } from "vitest";
import { riskMetadataPatchSchema } from "./validation";

describe("riskMetadataPatchSchema", () => {
  it("normalizes an empty risk score to null", () => {
    expect(riskMetadataPatchSchema.parse({ risk_score: "" }).risk_score).toBeNull();
  });
});
