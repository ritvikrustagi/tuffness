import type { ComplianceImpact, ImpactLevel, RiskCategory, RiskTier } from "./types";

type RiskScoreInput = {
  category?: RiskCategory | null;
  schedule_impact?: ImpactLevel | null;
  cost_impact?: ImpactLevel | null;
  compliance_impact?: ComplianceImpact | null;
  confidence?: number | null;
};

const impactWeights: Record<ImpactLevel, number> = {
  none: 0,
  minor: 10,
  moderate: 24,
  major: 38,
  critical: 78,
};

const categoryWeights: Record<RiskCategory, number> = {
  coordination: 8,
  schedule: 14,
  cost: 12,
  compliance: 22,
  code_or_life_safety: 68,
};

const complianceWeights: Record<ComplianceImpact, number> = {
  none: 0,
  specification: 14,
  code: 24,
  permit: 20,
  life_safety: 28,
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateRiskScore(risk: RiskScoreInput) {
  const confidence = Math.max(0, Math.min(1, risk.confidence ?? 0.7));
  const scheduleImpact = impactWeights[risk.schedule_impact ?? "none"];
  const costImpact = impactWeights[risk.cost_impact ?? "none"];
  const categoryImpact = categoryWeights[risk.category ?? "coordination"];
  const complianceImpact = complianceWeights[risk.compliance_impact ?? "none"];

  const rawScore = categoryImpact + scheduleImpact + costImpact + complianceImpact;
  const confidenceAdjustedScore = rawScore * (0.65 + confidence * 0.35);

  return clampScore(confidenceAdjustedScore);
}

export function getRiskTier(score: number): RiskTier {
  const clampedScore = clampScore(score);

  if (clampedScore >= 90) return "critical";
  if (clampedScore >= 70) return "high";
  if (clampedScore >= 45) return "medium";
  return "low";
}
