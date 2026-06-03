import type { Issue, IssueEvidence, Rfi } from "@/lib/types/database";

export const severityColors: Record<Issue["severity"], string> = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export function formatIssueType(type: Issue["issue_type"]) {
  return type.replace(/_/g, " ");
}

export function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function getRfi(issue: Issue): Rfi | undefined {
  if (!issue.rfis) return undefined;
  return Array.isArray(issue.rfis) ? issue.rfis[0] : issue.rfis;
}

export function evidenceText(item: IssueEvidence) {
  return item.excerpt ?? item.quote ?? "";
}
