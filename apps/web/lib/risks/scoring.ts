import type { ComplianceImpact, ImpactLevel, RiskTier } from "./types";
import type { IssueSeverity } from "../types/database";

export type RiskScoreInput = {
  severity?: IssueSeverity | null;
  cost_impact?: ImpactLevel | null;
  schedule_impact?: ImpactLevel | null;
  compliance_impact?: ComplianceImpact | null;
  confidence?: number | null;
  evidence_count?: number | null;
  blocks_work?: boolean | null;
};

const impactWeights: Record<ImpactLevel, number> = {
  none: 0,
  low: 10,
  medium: 22,
  high: 36,
  critical: 54,
};

const severityWeights: Record<IssueSeverity, number> = {
  low: 8,
  medium: 20,
  high: 34,
  critical: 52,
};

const complianceWeights: Record<ComplianceImpact, number> = {
  none: 0,
  possible_noncompliance: 16,
  spec_deviation: 18,
  code_or_life_safety: 58,
  submittal_required: 12,
  owner_approval_required: 12,
  inspection_or_testing_required: 16,
  closeout_required: 10,
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateRiskScore(risk: RiskScoreInput) {
  const confidence = Math.max(0, Math.min(1, risk.confidence ?? 0.7));
  const costImpact = impactWeights[risk.cost_impact ?? "none"];
  const scheduleImpact = impactWeights[risk.schedule_impact ?? "none"];
  const severityImpact = severityWeights[risk.severity ?? "medium"];
  const complianceImpact = complianceWeights[risk.compliance_impact ?? "none"];
  const evidenceImpact = Math.min(8, Math.max(0, risk.evidence_count ?? 0) * 2);
  const blockerImpact = risk.blocks_work ? 8 : 0;

  const rawScore =
    severityImpact + costImpact + scheduleImpact + complianceImpact + evidenceImpact + blockerImpact;
  const confidenceAdjustedScore = rawScore * (0.75 + confidence * 0.25);
  const risk_score = clampScore(confidenceAdjustedScore);

  return {
    risk_score,
    risk_tier: getRiskTier(risk_score),
  };
}

export function getRiskTier(score: number): RiskTier {
  const clampedScore = clampScore(score);

  if (clampedScore >= 90) return "critical";
  if (clampedScore >= 70) return "high";
  if (clampedScore >= 45) return "medium";
  return "low";
}
