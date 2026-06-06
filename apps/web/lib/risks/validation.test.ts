import { describe, expect, it } from "vitest";
import { riskMetadataPatchSchema, riskReviewCommandSchema } from "./validation";

describe("riskMetadataPatchSchema", () => {
  it("normalizes an empty risk score to null", () => {
    expect(riskMetadataPatchSchema.parse({ risk_score: "" }).risk_score).toBeNull();
  });

  it("rejects review commands in the metadata patch", () => {
    expect(() => riskMetadataPatchSchema.strict().parse({ reviewed: true })).toThrow();
  });

  it("accepts explicit human review completion as a separate command", () => {
    expect(riskReviewCommandSchema.parse({ mark_reviewed: true }).mark_reviewed).toBe(true);
  });

  it("rejects clearing human review through the review command", () => {
    expect(() => riskReviewCommandSchema.parse({ mark_reviewed: false })).toThrow();
  });
});
