import type { RiskEvidence, RiskLike } from "./types";

const riskCsvHeaders = [
  "Risk Tier",
  "Summary",
  "Risk Category",
  "Cost Impact",
  "Schedule Impact",
  "Compliance Impact",
  "Trade",
  "Responsible Party",
  "Spec Section",
  "Drawing Sheet",
  "Required Artifact",
  "Confidence",
  "Workflow State",
  "Recommended Action",
  "Evidence References",
] as const;

function quoteCsvCell(value: string | number | null | undefined) {
  const cell = String(value ?? "");
  const neutralizedCell = /^[\t\r\n ]*[=+\-@]/.test(cell) ? `'${cell}` : cell;

  return `"${neutralizedCell.replaceAll('"', '""')}"`;
}

function formatEvidence(evidence: RiskEvidence) {
  const documentName = evidence.document_name ?? "Unknown document";
  const pageNumber = evidence.page_number ? ` p.${evidence.page_number}` : "";
  const text = evidence.quote ?? evidence.excerpt ?? "";

  return `${documentName}${pageNumber}: ${text}`.trim();
}

export function buildRiskCsv(risks: RiskLike[]) {
  const rows = risks.map((risk) => [
    risk.risk_tier,
    risk.summary,
    risk.risk_category,
    risk.cost_impact,
    risk.schedule_impact,
    risk.compliance_impact,
    risk.trade,
    risk.responsible_party,
    risk.spec_section,
    risk.drawing_sheet,
    risk.required_artifact,
    risk.confidence,
    risk.status,
    risk.recommended_action,
    (risk.evidence ?? []).map(formatEvidence).join("\n"),
  ]);

  return [riskCsvHeaders, ...rows]
    .map((row) => row.map((cell) => quoteCsvCell(cell)).join(","))
    .join("\n");
}
