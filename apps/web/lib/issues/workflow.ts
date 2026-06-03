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

export function isIssueTransitionAllowed(current: IssueStatus, next: IssueStatus): boolean {
  return current === next || getAllowedIssueTransitions(current).includes(next);
}

export type IssueWorkflowDraft = {
  status: IssueStatus;
  rfi_status: RfiStatus;
  trade: string;
  discipline: string;
  due_date: string;
  external_system_url: string;
  external_rfi_number: string;
  external_url: string;
  response: string;
  resolution_notes: string;
  draft_rfi: string;
};

type WorkflowIssueInput = {
  status: IssueStatus;
  trade: string | null;
  discipline: string | null;
  due_date: string | null;
  external_system_url: string | null;
  resolution_notes: string | null;
  draft_rfi: string | null;
};

type WorkflowRfiInput = {
  status: RfiStatus;
  external_rfi_number: string | null;
  external_url: string | null;
  question: string;
  response: string | null;
};

export function getInitialIssueWorkflowDraft(input: {
  issue: WorkflowIssueInput;
  rfi?: WorkflowRfiInput | null;
}): IssueWorkflowDraft {
  const { issue, rfi } = input;

  return {
    status: issue.status,
    rfi_status: rfi?.status ?? "draft",
    trade: issue.trade ?? "",
    discipline: issue.discipline ?? "",
    due_date: issue.due_date ?? "",
    external_system_url: issue.external_system_url ?? "",
    external_rfi_number: rfi?.external_rfi_number ?? "",
    external_url: rfi?.external_url ?? "",
    response: rfi?.response ?? "",
    resolution_notes: issue.resolution_notes ?? "",
    draft_rfi: rfi?.question ?? issue.draft_rfi ?? "",
  };
}

function cleanText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildIssueWorkflowPatch(input: IssueWorkflowDraft): {
  status: IssueStatus;
  rfi_status: RfiStatus;
  trade: string | null;
  discipline: string | null;
  due_date: string | null;
  external_system_url: string | null;
  external_rfi_number: string | null;
  external_url: string | null;
  response: string | null;
  resolution_notes: string | null;
  draft_rfi: string | null;
} {
  return {
    status: input.status,
    rfi_status: input.rfi_status,
    trade: cleanText(input.trade),
    discipline: cleanText(input.discipline),
    due_date: cleanText(input.due_date),
    external_system_url: cleanText(input.external_system_url),
    external_rfi_number: cleanText(input.external_rfi_number),
    external_url: cleanText(input.external_url),
    response: cleanText(input.response),
    resolution_notes: cleanText(input.resolution_notes),
    draft_rfi: cleanText(input.draft_rfi),
  };
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
  external_rfi_number?: string | null;
  external_url?: string | null;
  response?: string | null;
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
