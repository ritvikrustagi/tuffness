import { z } from "zod";
import {
  complianceImpacts,
  impactLevels,
  requiredArtifacts,
  riskCategories,
  riskTiers,
} from "./types";

const emptyStringToNull = (value: unknown) => (value === "" ? null : value);

const nullableString = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().max(max).nullable().optional());

const nullableRiskScore = z.preprocess((value) => {
  if (value === "") return null;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().int().min(0).max(100).nullable().optional());

export const riskMetadataPatchSchema = z.object({
  risk_category: z.preprocess(emptyStringToNull, z.enum(riskCategories).nullable().optional()),
  risk_score: nullableRiskScore,
  risk_tier: z.preprocess(emptyStringToNull, z.enum(riskTiers).nullable().optional()),
  cost_impact: z.preprocess(emptyStringToNull, z.enum(impactLevels).nullable().optional()),
  schedule_impact: z.preprocess(emptyStringToNull, z.enum(impactLevels).nullable().optional()),
  compliance_impact: z.preprocess(emptyStringToNull, z.enum(complianceImpacts).nullable().optional()),
  responsible_party: nullableString(200),
  responsible_trade: nullableString(100),
  spec_section: nullableString(100),
  drawing_sheet: nullableString(100),
  required_artifact: z.preprocess(emptyStringToNull, z.enum(requiredArtifacts).nullable().optional()),
  blocked_activity: nullableString(400),
  risk_reasoning: nullableString(4000),
  evidence_strength: z.preprocess(
    emptyStringToNull,
    z.enum(["weak", "moderate", "strong"]).nullable().optional()
  ),
});

export type RiskMetadataPatch = z.infer<typeof riskMetadataPatchSchema>;
