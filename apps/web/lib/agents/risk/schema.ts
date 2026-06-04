import { z } from "zod";
import {
  complianceImpacts,
  impactLevels,
  requiredArtifacts,
  riskCategories,
} from "../../risks/types";

export const riskEvidenceSchema = z.object({
  document_id: z.string().uuid(),
  document_name: z.string().min(1),
  page_number: z.number().int().positive(),
  quote: z.string().min(1),
});

export const riskFindingSchema = z.object({
  risk_category: z.enum(riskCategories),
  severity: z.enum(["low", "medium", "high", "critical"]),
  cost_impact: z.enum(impactLevels),
  schedule_impact: z.enum(impactLevels),
  compliance_impact: z.enum(complianceImpacts),
  required_artifact: z.enum(requiredArtifacts),
  responsible_party: z.string().min(1).max(200).optional(),
  responsible_trade: z.string().min(1).max(100).optional(),
  spec_section: z.string().min(1).max(100).optional(),
  drawing_sheet: z.string().min(1).max(100).optional(),
  blocked_activity: z.string().min(1).max(400).optional(),
  summary: z.string().min(1).max(500),
  description: z.string().min(1).max(2500),
  evidence: z.array(riskEvidenceSchema).min(1).max(10),
  draft_rfi: z.string().min(1).max(4000).optional(),
  confidence: z.number().min(0).max(1),
  evidence_strength: z.enum(["weak", "moderate", "strong"]),
  recommended_action: z.string().min(1).max(1000),
});

export const riskAgentOutputSchema = z.object({
  risks: z.array(riskFindingSchema).max(10),
});

export type RiskAgentOutput = z.infer<typeof riskAgentOutputSchema>;
export type RiskFinding = z.infer<typeof riskFindingSchema>;
export type RiskEvidence = z.infer<typeof riskEvidenceSchema>;
