import type { IssueEvidence, IssueStatus, RfiStatus } from "@/lib/types/database";

export const issueStatuses = [
  "open",
  "acknowledged",
  "draft_rfi",
  "submitted",
  "answered",
  "resolved",
  "dismissed",
] as const satisfies readonly IssueStatus[];

export const rfiStatuses = [
  "draft",
  "needs_edit",
  "approved",
  "submitted_externally",
  "answered",
  "closed",
] as const satisfies readonly RfiStatus[];

const issueTransitions: Record<IssueStatus, IssueStatus[]> = {
  open: ["acknowledged", "draft_rfi", "resolved", "dismissed"],
  acknowledged: ["draft_rfi", "resolved", "dismissed"],
  draft_rfi: ["submitted", "resolved", "dismissed"],
  submitted: ["answered", "resolved"],
  answered: ["resolved"],
  resolved: ["open"],
  dismissed: ["open"],
};

export function getAllowedIssueTransitions(status: IssueStatus): IssueStatus[] {
  return issueTransitions[status] ?? [];
}

export function normalizeIssueEvidence(
  evidence: Array<{
    document_id: string;
    document_name: string;
    page_number: number;
    quote: string;
  }>
): IssueEvidence[] {
  return evidence.map((item) => ({
    document_id: item.document_id,
    document_name: item.document_name,
    page_number: item.page_number,
    excerpt: item.quote,
    quote: item.quote,
  }));
}

export function buildDraftRfiPatch(input: {
  status: RfiStatus;
  external_rfi_number?: string;
  external_url?: string;
  response?: string;
}) {
  const patch: Record<string, string | null> = {
    status: input.status,
  };

  if (input.external_rfi_number !== undefined) {
    patch.external_rfi_number = input.external_rfi_number || null;
  }

  if (input.external_url !== undefined) {
    patch.external_url = input.external_url || null;
  }

  if (input.response !== undefined) {
    patch.response = input.response || null;
  }

  if (input.status === "submitted_externally") {
    patch.submitted_at = new Date().toISOString();
  }

  if (input.status === "answered") {
    patch.answered_at = new Date().toISOString();
  }

  return patch;
}
