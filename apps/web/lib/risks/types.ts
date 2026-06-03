export const riskCategories = [
  "coordination",
  "schedule",
  "cost",
  "compliance",
  "code_or_life_safety",
] as const;

export const impactLevels = ["none", "minor", "moderate", "major", "critical"] as const;

export const complianceImpacts = [
  "none",
  "specification",
  "code",
  "permit",
  "life_safety",
] as const;

export const requiredArtifacts = ["none", "rfi", "submittal", "change_order"] as const;

export const riskTiers = ["low", "medium", "high", "critical"] as const;

export type RiskCategory = (typeof riskCategories)[number];
export type ImpactLevel = (typeof impactLevels)[number];
export type ComplianceImpact = (typeof complianceImpacts)[number];
export type RequiredArtifact = (typeof requiredArtifacts)[number];
export type RiskTier = (typeof riskTiers)[number];

export type RiskEvidence = {
  document_id?: string | null;
  document_name?: string | null;
  page_number?: number | null;
  text?: string | null;
  quote?: string | null;
  excerpt?: string | null;
};

export type RiskLike = {
  id?: string | null;
  title?: string | null;
  summary?: string | null;
  status?: string | null;
  tier?: RiskTier | null;
  category?: RiskCategory | null;
  schedule_impact?: ImpactLevel | null;
  cost_impact?: ImpactLevel | null;
  compliance_impact?: ComplianceImpact | null;
  required_artifact?: RequiredArtifact | null;
  confidence?: number | null;
  evidence?: RiskEvidence[] | null;
};
