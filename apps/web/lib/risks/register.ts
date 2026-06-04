import {
  getComplianceGroup,
  isComplianceRisk,
  type ComplianceGroup,
} from "./compliance";
import type { ComplianceImpact, RequiredArtifact, RiskLike, RiskTier } from "./types";

export type RiskRegisterView = "all" | "compliance";
export type RiskRegisterTierFilter = "all" | RiskTier;
export type RiskRegisterComplianceFilter = "all" | ComplianceImpact;
export type RiskRegisterArtifactFilter = "all" | RequiredArtifact;
export type RiskRegisterGroupFilter = "all" | ComplianceGroup;

export interface RiskRegisterFilters {
  view: RiskRegisterView;
  tierFilter: RiskRegisterTierFilter;
  complianceFilter: RiskRegisterComplianceFilter;
  artifactFilter: RiskRegisterArtifactFilter;
  groupFilter: RiskRegisterGroupFilter;
}

export function filterRiskRegisterRisks<T extends RiskLike>(
  risks: T[],
  filters: RiskRegisterFilters
) {
  const complianceView = filters.view === "compliance";

  return risks.filter((risk) => {
    const matchesView = !complianceView || isComplianceRisk(risk);
    const matchesTier =
      filters.tierFilter === "all" || risk.risk_tier === filters.tierFilter;
    const matchesCompliance =
      filters.complianceFilter === "all" ||
      risk.compliance_impact === filters.complianceFilter;
    const matchesArtifact =
      !complianceView ||
      filters.artifactFilter === "all" ||
      risk.required_artifact === filters.artifactFilter;
    const matchesGroup =
      !complianceView ||
      filters.groupFilter === "all" ||
      getComplianceGroup(risk) === filters.groupFilter;

    return (
      matchesView &&
      matchesTier &&
      matchesCompliance &&
      matchesArtifact &&
      matchesGroup
    );
  });
}
