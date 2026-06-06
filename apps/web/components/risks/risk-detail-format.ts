import type { Issue } from "@/lib/types/database";

export function formatRiskLabel(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "Not specified";
}

export function formatRiskScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : value.toFixed(0);
}

export function formatRiskConfidence(value: number | null | undefined) {
  return value === null || value === undefined ? "Not set" : `${(value * 100).toFixed(0)}%`;
}

export function riskOwner(issue: Issue) {
  return issue.responsible_party ?? issue.responsible_trade ?? issue.trade ?? "Not assigned";
}
