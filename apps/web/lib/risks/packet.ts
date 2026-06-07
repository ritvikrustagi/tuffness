import type { RiskEvidence, RiskLike } from "./types";

type CompliancePacketRisk = RiskLike & {
  risk_score?: number | null;
  description?: string | null;
};

export type CompliancePacketInput = {
  risk: CompliancePacketRisk;
  draftRfi?: string | null;
};

function formatLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "Not specified";
}

function formatConfidence(value: number | null | undefined) {
  return value === null || value === undefined ? "Not set" : `${(value * 100).toFixed(0)}%`;
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : value.toFixed(0);
}

function formatResponsible(risk: CompliancePacketRisk) {
  const parts = [risk.responsible_party, risk.responsible_trade ?? risk.trade].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Not assigned";
}

function formatEvidence(evidence: RiskEvidence, index: number) {
  const documentName = evidence.document_name ?? "Unknown document";
  const pageNumber = evidence.page_number ? `, page ${evidence.page_number}` : "";
  const text = evidence.quote ?? evidence.excerpt ?? "Evidence excerpt unavailable.";

  return `${index + 1}. ${documentName}${pageNumber}: ${text}`;
}

function cleanOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function buildCompliancePacketDownloadName(summary: string | null | undefined) {
  const safeSummary = (summary ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return safeSummary ? `${safeSummary}-compliance-packet.txt` : "compliance-packet.txt";
}

export function buildCompliancePacketText({ risk, draftRfi }: CompliancePacketInput) {
  const cleanedDraftRfi = cleanOptionalText(draftRfi);
  const evidence =
    risk.evidence && risk.evidence.length > 0
      ? risk.evidence.map(formatEvidence)
      : ["1. Evidence excerpt unavailable."];
  const lines = [
    `Compliance Packet: ${risk.summary ?? "Untitled item"}`,
    "",
    "Risk / Compliance",
    `Risk Tier: ${formatLabel(risk.risk_tier)}`,
    `Risk Score: ${formatScore(risk.risk_score)}`,
    `Risk Category: ${formatLabel(risk.risk_category)}`,
    `Compliance Impact: ${formatLabel(risk.compliance_impact)}`,
    `Required Artifact: ${formatLabel(risk.required_artifact)}`,
    `Confidence: ${formatConfidence(risk.confidence)}`,
    `Workflow Status: ${formatLabel(risk.status)}`,
    "",
    "References",
    `Spec Section: ${risk.spec_section ?? "Not specified"}`,
    `Drawing Sheet: ${risk.drawing_sheet ?? "Not specified"}`,
    `Responsible: ${formatResponsible(risk)}`,
    "",
    `Recommended Action: ${risk.recommended_action ?? "Not specified"}`,
    "",
    "Evidence",
    ...evidence,
    ...(cleanedDraftRfi ? ["", "Draft RFI:", cleanedDraftRfi] : []),
  ];

  return lines.join("\n");
}
