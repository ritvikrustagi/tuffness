import type { ComplianceImpact, RequiredArtifact, RiskEvidence, RiskLike } from "./types";

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

type ComplianceSummaryBucket = Exclude<
  keyof ComplianceSummary,
  "total" | "open" | "high_impact" | "awaiting_review"
>;

export const complianceGroups = [
  "rfi_needed",
  "submittal_required",
  "inspection_or_testing_required",
  "owner_approval_required",
  "possible_spec_deviation",
  "closeout_required",
] as const;

export type ComplianceGroup = (typeof complianceGroups)[number];

type ComplianceGroupDefinition = {
  summaryKey: ComplianceSummaryBucket | null;
  artifacts: readonly RequiredArtifact[];
  impacts: readonly ComplianceImpact[];
};

const complianceGroupDefinitions: Record<ComplianceGroup, ComplianceGroupDefinition> = {
  rfi_needed: {
    summaryKey: "rfi_needed",
    artifacts: ["rfi"],
    impacts: [],
  },
  submittal_required: {
    summaryKey: "submittals_required",
    artifacts: ["submittal"],
    impacts: ["submittal_required"],
  },
  inspection_or_testing_required: {
    summaryKey: "inspection_or_testing_required",
    artifacts: ["test_report", "inspection"],
    impacts: ["inspection_or_testing_required"],
  },
  owner_approval_required: {
    summaryKey: "owner_approvals_required",
    artifacts: ["owner_approval"],
    impacts: ["owner_approval_required"],
  },
  possible_spec_deviation: {
    summaryKey: null,
    artifacts: [],
    impacts: ["spec_deviation"],
  },
  closeout_required: {
    summaryKey: "closeout_required",
    artifacts: ["closeout_document"],
    impacts: ["closeout_required"],
  },
};

function definitionIncludesArtifact(
  definition: { artifacts: readonly RequiredArtifact[] },
  artifact: RequiredArtifact
) {
  return definition.artifacts.includes(artifact);
}

function definitionIncludesImpact(
  definition: { impacts: readonly ComplianceImpact[] },
  impact: ComplianceImpact
) {
  return definition.impacts.includes(impact);
}

function groupForArtifact(artifact: RequiredArtifact | null | undefined) {
  if (!artifact || artifact === "none") return null;

  return (
    complianceGroups.find((group) =>
      definitionIncludesArtifact(complianceGroupDefinitions[group], artifact)
    ) ?? null
  );
}

function groupForImpact(impact: ComplianceImpact | null | undefined) {
  if (!impact || impact === "none") return null;

  return (
    complianceGroups.find((group) =>
      definitionIncludesImpact(complianceGroupDefinitions[group], impact)
    ) ?? null
  );
}

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

export function getComplianceGroup(
  risk: Pick<RiskLike, "required_artifact" | "compliance_impact">
): ComplianceGroup | null {
  return groupForArtifact(risk.required_artifact) ?? groupForImpact(risk.compliance_impact);
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

      const summaryKey = group ? complianceGroupDefinitions[group].summaryKey : null;
      if (!closed && summaryKey) summary[summaryKey] += 1;

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
