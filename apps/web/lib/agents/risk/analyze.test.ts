import { describe, expect, test } from "vitest";
import {
  complianceImpacts,
  impactLevels,
  requiredArtifacts,
  riskCategories,
} from "@/lib/risks/types";
import { buildRiskSystemPrompt } from "./analyze";

describe("risk analysis prompt", () => {
  test("renders risk taxonomy from canonical risk constants", () => {
    const prompt = buildRiskSystemPrompt("Doors");

    expect(prompt).toContain(`risk_category must be one of: ${riskCategories.join(", ")}.`);
    expect(prompt).toContain(
      `cost_impact and schedule_impact must be one of: ${impactLevels.join(", ")}.`
    );
    expect(prompt).toContain(
      `compliance_impact must be one of: ${complianceImpacts.join(", ")}.`
    );
    expect(prompt).toContain(
      `required_artifact must be one of: ${requiredArtifacts.join(", ")}.`
    );
  });
});
