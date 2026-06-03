import type { RiskEvidence, RiskLike } from "./types";

const riskCsvHeaders = [
  "id",
  "title",
  "status",
  "tier",
  "category",
  "compliance_impact",
  "required_artifact",
  "evidence",
] as const;

function quoteCsvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatEvidence(evidence: RiskEvidence) {
  const documentName = evidence.document_name ?? "Unknown document";
  const pageNumber = evidence.page_number ? ` p.${evidence.page_number}` : "";
  const text = evidence.text ?? evidence.quote ?? evidence.excerpt ?? "";

  return `${documentName}${pageNumber}: ${text}`.trim();
}

export function buildRiskCsv(risks: RiskLike[]) {
  const rows = risks.map((risk) => [
    risk.id,
    risk.title ?? risk.summary,
    risk.status,
    risk.tier,
    risk.category,
    risk.compliance_impact,
    risk.required_artifact,
    (risk.evidence ?? []).map(formatEvidence).join("\n"),
  ]);

  return [riskCsvHeaders, ...rows]
    .map((row) => row.map((cell) => quoteCsvCell(cell)).join(","))
    .join("\n");
}
