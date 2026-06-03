import type { IssueStatus } from "../types/database";

export const riskCategories = [
  "drawing_spec_conflict",
  "missing_information",
  "coordination_conflict",
  "submittal_requirement",
  "possible_spec_deviation",
  "owner_design_approval",
  "schedule_constraint",
  "cost_exposure",
  "closeout_risk",
  "other",
] as const;

export const impactLevels = ["none", "low", "medium", "high", "critical"] as const;

export const complianceImpacts = [
  "none",
  "possible_noncompliance",
  "spec_deviation",
  "code_or_life_safety",
  "submittal_required",
  "owner_approval_required",
  "inspection_or_testing_required",
  "closeout_required",
] as const;

export const requiredArtifacts = [
  "none",
  "rfi",
  "submittal",
  "test_report",
  "owner_approval",
  "inspection",
  "closeout_document",
] as const;

export const riskTiers = ["low", "medium", "high", "critical"] as const;

export type RiskCategory = (typeof riskCategories)[number];
export type ImpactLevel = (typeof impactLevels)[number];
export type ComplianceImpact = (typeof complianceImpacts)[number];
export type RequiredArtifact = (typeof requiredArtifacts)[number];
export type RiskTier = (typeof riskTiers)[number];

export type RiskEvidence = {
  document_name?: string | null;
  page_number?: number | null;
  quote?: string | null;
  excerpt?: string | null;
};

export type RiskLike = {
  id?: string;
  summary?: string | null;
  status?: IssueStatus | null;
  risk_tier?: RiskTier | null;
  risk_category?: RiskCategory | null;
  cost_impact?: ImpactLevel | null;
  schedule_impact?: ImpactLevel | null;
  compliance_impact?: ComplianceImpact | null;
  trade?: string | null;
  responsible_party?: string | null;
  spec_section?: string | null;
  drawing_sheet?: string | null;
  required_artifact?: RequiredArtifact | null;
  confidence?: number | null;
  recommended_action?: string | null;
  evidence?: RiskEvidence[] | null;
};
