import type {
  ComplianceImpact,
  EvidenceStrength,
  ImpactLevel,
  Issue,
  RequiredArtifact,
  RiskCategory,
  RiskTier,
} from "@/lib/types/database";

export type RiskMetadataDraft = {
  risk_category: RiskCategory | "";
  risk_score: string;
  risk_tier: RiskTier | "";
  cost_impact: ImpactLevel | "";
  schedule_impact: ImpactLevel | "";
  compliance_impact: ComplianceImpact | "";
  responsible_party: string;
  responsible_trade: string;
  spec_section: string;
  drawing_sheet: string;
  required_artifact: RequiredArtifact | "";
  blocked_activity: string;
  risk_reasoning: string;
  evidence_strength: EvidenceStrength | "";
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildRiskMetadataDraft(issue: Issue): RiskMetadataDraft {
  return {
    risk_category: issue.risk_category ?? "",
    risk_score: issue.risk_score === null ? "" : String(issue.risk_score),
    risk_tier: issue.risk_tier ?? "",
    cost_impact: issue.cost_impact ?? "",
    schedule_impact: issue.schedule_impact ?? "",
    compliance_impact: issue.compliance_impact ?? "",
    responsible_party: issue.responsible_party ?? "",
    responsible_trade: issue.responsible_trade ?? "",
    spec_section: issue.spec_section ?? "",
    drawing_sheet: issue.drawing_sheet ?? "",
    required_artifact: issue.required_artifact ?? "",
    blocked_activity: issue.blocked_activity ?? "",
    risk_reasoning: issue.risk_reasoning ?? "",
    evidence_strength: issue.evidence_strength ?? "",
  };
}

export function buildRiskMetadataPayload(draft: RiskMetadataDraft) {
  return {
    risk_category: draft.risk_category || null,
    risk_score: draft.risk_score.trim() === "" ? null : Number(draft.risk_score),
    risk_tier: draft.risk_tier || null,
    cost_impact: draft.cost_impact || null,
    schedule_impact: draft.schedule_impact || null,
    compliance_impact: draft.compliance_impact || null,
    responsible_party: emptyToNull(draft.responsible_party),
    responsible_trade: emptyToNull(draft.responsible_trade),
    spec_section: emptyToNull(draft.spec_section),
    drawing_sheet: emptyToNull(draft.drawing_sheet),
    required_artifact: draft.required_artifact || null,
    blocked_activity: emptyToNull(draft.blocked_activity),
    risk_reasoning: emptyToNull(draft.risk_reasoning),
    evidence_strength: draft.evidence_strength || null,
  };
}
