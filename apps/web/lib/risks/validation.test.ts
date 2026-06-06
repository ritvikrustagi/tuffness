import { describe, expect, it } from "vitest";
import { riskMetadataPatchSchema } from "./validation";

describe("riskMetadataPatchSchema", () => {
  it("normalizes an empty risk score to null", () => {
    expect(riskMetadataPatchSchema.parse({ risk_score: "" }).risk_score).toBeNull();
  });

  it("accepts explicit human review completion", () => {
    expect(riskMetadataPatchSchema.parse({ reviewed: true }).reviewed).toBe(true);
  });

  it("rejects clearing human review through the client patch", () => {
    expect(() => riskMetadataPatchSchema.parse({ reviewed: false })).toThrow();
  });
});
