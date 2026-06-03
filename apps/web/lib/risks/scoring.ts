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
  medium: 24,
  high: 38,
  critical: 52,
};

const severityWeights: Record<IssueSeverity, number> = {
  low: 4,
  medium: 12,
  high: 22,
  critical: 32,
};

const complianceWeights: Record<ComplianceImpact, number> = {
  none: 0,
  possible_noncompliance: 18,
  spec_deviation: 28,
  code_or_life_safety: 58,
  submittal_required: 22,
  owner_approval_required: 24,
  inspection_or_testing_required: 26,
  closeout_required: 18,
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateRiskScore(risk: RiskScoreInput) {
  const confidence = Math.max(0, Math.min(1, risk.confidence ?? 0.7));
  const costImpact = impactWeights[risk.cost_impact ?? "none"];
  const scheduleImpact = impactWeights[risk.schedule_impact ?? "none"];
  const strongestImpact = Math.max(costImpact, scheduleImpact);
  const severityImpact = severityWeights[risk.severity ?? "medium"];
  const complianceImpact = complianceWeights[risk.compliance_impact ?? "none"];
  const evidenceBonus = Math.min(Math.max(0, risk.evidence_count ?? 0), 3) * 4;
  const blockerBonus = risk.blocks_work ? 10 : 0;
  const confidenceModifier = confidence < 0.5 ? -12 : confidence >= 0.8 ? 8 : 0;

  const rawScore =
    strongestImpact +
    severityImpact +
    complianceImpact +
    evidenceBonus +
    blockerBonus +
    confidenceModifier;
  const risk_score = clampScore(rawScore);

  return {
    risk_score,
    risk_tier: getRiskTier(risk_score),
  };
}

export function getRiskTier(score: number): RiskTier {
  const clampedScore = clampScore(score);

  if (clampedScore >= 85) return "critical";
  if (clampedScore >= 60) return "high";
  if (clampedScore >= 30) return "medium";
  return "low";
}
