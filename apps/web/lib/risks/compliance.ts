import type { ComplianceImpact, RequiredArtifact, RiskEvidence, RiskLike } from "./types";

export const complianceGroups = [
  "rfi_needed",
  "submittal_required",
  "inspection_or_testing_required",
  "owner_approval_required",
  "possible_spec_deviation",
  "closeout_required",
] as const;

export type ComplianceGroup = (typeof complianceGroups)[number];

export type ComplianceSummary = {
  total: number;
  open: number;
  high_impact: number;
  rfi_needed: number;
  submittals_required: number;
  inspection_or_testing_required: number;
  owner_approvals_required: number;
  closeout_required: number;
  awaiting_review: number;
};

const artifactGroups: Partial<Record<RequiredArtifact, ComplianceGroup>> = {
  rfi: "rfi_needed",
  submittal: "submittal_required",
  test_report: "inspection_or_testing_required",
  inspection: "inspection_or_testing_required",
  owner_approval: "owner_approval_required",
  closeout_document: "closeout_required",
};

function isClosed(risk: RiskLike) {
  return risk.status === "resolved" || risk.status === "dismissed";
}

function formatLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "Not specified";
}

function formatEvidence(evidence: RiskEvidence, index: number) {
  const documentName = evidence.document_name ?? "Unknown document";
  const pageNumber = evidence.page_number ? `, page ${evidence.page_number}` : "";
  const text = evidence.quote ?? evidence.excerpt ?? "Evidence excerpt unavailable.";

  return `${index + 1}. ${documentName}${pageNumber}: ${text}`;
}

function responsibleText(risk: RiskLike) {
  const parts = [risk.responsible_party, risk.responsible_trade ?? risk.trade].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Not assigned";
}

export function getComplianceGroup(risk: Pick<RiskLike, "required_artifact" | "compliance_impact">): ComplianceGroup | null {
  if (risk.required_artifact && risk.required_artifact !== "none") {
    return artifactGroups[risk.required_artifact] ?? null;
  }

  if (risk.compliance_impact === "spec_deviation") return "possible_spec_deviation";
  if (risk.compliance_impact === "submittal_required") return "submittal_required";
  if (risk.compliance_impact === "owner_approval_required") return "owner_approval_required";
  if (risk.compliance_impact === "inspection_or_testing_required") {
    return "inspection_or_testing_required";
  }
  if (risk.compliance_impact === "closeout_required") return "closeout_required";

  return null;
}

export function isComplianceRisk(risk: Pick<RiskLike, "required_artifact" | "compliance_impact">) {
  return Boolean(
    (risk.compliance_impact && risk.compliance_impact !== "none") ||
      (risk.required_artifact && risk.required_artifact !== "none")
  );
}

export function isHighImpactCompliance(value: ComplianceImpact | null | undefined) {
  return value === "code_or_life_safety" || value === "spec_deviation";
}

function isHighPriorityCompliance(risk: RiskLike) {
  return (
    isHighImpactCompliance(risk.compliance_impact) ||
    risk.risk_tier === "critical" ||
    risk.risk_tier === "high"
  );
}

export function summarizeComplianceRisks(risks: RiskLike[]): ComplianceSummary {
  return risks.filter(isComplianceRisk).reduce<ComplianceSummary>(
    (summary, risk) => {
      const group = getComplianceGroup(risk);
      const closed = isClosed(risk);

      summary.total += 1;
      if (!closed) summary.open += 1;
      if (!closed && !risk.human_reviewed_at) summary.awaiting_review += 1;
      if (!closed && isHighPriorityCompliance(risk)) summary.high_impact += 1;

      if (!closed && group === "rfi_needed") summary.rfi_needed += 1;
      if (!closed && group === "submittal_required") summary.submittals_required += 1;
      if (!closed && group === "inspection_or_testing_required") {
        summary.inspection_or_testing_required += 1;
      }
      if (!closed && group === "owner_approval_required") summary.owner_approvals_required += 1;
      if (!closed && group === "closeout_required") summary.closeout_required += 1;

      return summary;
    },
    {
      total: 0,
      open: 0,
      high_impact: 0,
      rfi_needed: 0,
      submittals_required: 0,
      inspection_or_testing_required: 0,
      owner_approvals_required: 0,
      closeout_required: 0,
      awaiting_review: 0,
    }
  );
}

export function buildComplianceItemText(risk: RiskLike) {
  const lines = [
    `Compliance Item: ${risk.summary ?? "Untitled item"}`,
    `Compliance Impact: ${formatLabel(risk.compliance_impact)}`,
    `Required Artifact: ${formatLabel(risk.required_artifact)}`,
    `Spec Section: ${risk.spec_section ?? "Not specified"}`,
    `Drawing Sheet: ${risk.drawing_sheet ?? "Not specified"}`,
    `Responsible: ${responsibleText(risk)}`,
    `Confidence: ${
      risk.confidence === null || risk.confidence === undefined
        ? "Not set"
        : `${(risk.confidence * 100).toFixed(0)}%`
    }`,
    risk.recommended_action ? `Recommended Action: ${risk.recommended_action}` : null,
    "",
    "Evidence:",
    ...(risk.evidence?.length
      ? risk.evidence.map(formatEvidence)
      : ["1. Evidence excerpt unavailable."]),
  ];

  return lines.filter((line) => line !== null).join("\n");
}
