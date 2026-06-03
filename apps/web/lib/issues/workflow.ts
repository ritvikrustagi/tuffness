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

export const issueWorkflowStates = [
  "open",
  "acknowledged",
  "draft_rfi",
  "needs_edit",
  "approved",
  "submitted",
  "answered",
  "resolved",
  "dismissed",
] as const;

export type IssueWorkflowState = (typeof issueWorkflowStates)[number];

const issueTransitions: Record<IssueStatus, IssueStatus[]> = {
  open: ["acknowledged", "draft_rfi", "resolved", "dismissed"],
  acknowledged: ["draft_rfi", "resolved", "dismissed"],
  draft_rfi: ["submitted", "resolved", "dismissed"],
  submitted: ["answered", "resolved"],
  answered: ["resolved"],
  resolved: ["open"],
  dismissed: ["open"],
};

const workflowTransitions: Record<IssueWorkflowState, IssueWorkflowState[]> = {
  open: ["acknowledged", "draft_rfi", "resolved", "dismissed"],
  acknowledged: ["draft_rfi", "resolved", "dismissed"],
  draft_rfi: ["needs_edit", "approved", "submitted", "resolved", "dismissed"],
  needs_edit: ["draft_rfi", "approved", "resolved", "dismissed"],
  approved: ["needs_edit", "submitted", "resolved", "dismissed"],
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

export function getAllowedWorkflowTransitions(state: IssueWorkflowState): IssueWorkflowState[] {
  return workflowTransitions[state] ?? [];
}

export function isWorkflowTransitionAllowed(
  current: IssueWorkflowState,
  next: IssueWorkflowState
): boolean {
  return current === next || getAllowedWorkflowTransitions(current).includes(next);
}

export type IssueWorkflowDraft = {
  workflow_state: IssueWorkflowState;
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

function workflowStateToStatuses(state: IssueWorkflowState): {
  status: IssueStatus;
  rfi_status: RfiStatus;
} {
  switch (state) {
    case "open":
      return { status: "open", rfi_status: "draft" };
    case "acknowledged":
      return { status: "acknowledged", rfi_status: "draft" };
    case "draft_rfi":
      return { status: "draft_rfi", rfi_status: "draft" };
    case "needs_edit":
      return { status: "draft_rfi", rfi_status: "needs_edit" };
    case "approved":
      return { status: "draft_rfi", rfi_status: "approved" };
    case "submitted":
      return { status: "submitted", rfi_status: "submitted_externally" };
    case "answered":
      return { status: "answered", rfi_status: "answered" };
    case "resolved":
      return { status: "resolved", rfi_status: "closed" };
    case "dismissed":
      return { status: "dismissed", rfi_status: "closed" };
  }
}

export function deriveWorkflowState(input: {
  issueStatus: IssueStatus;
  rfiStatus: RfiStatus | null;
}): IssueWorkflowState {
  if (input.issueStatus === "draft_rfi") {
    if (input.rfiStatus === "needs_edit") return "needs_edit";
    if (input.rfiStatus === "approved") return "approved";
    return "draft_rfi";
  }

  if (input.issueStatus === "submitted") return "submitted";
  if (input.issueStatus === "answered") return "answered";
  if (input.issueStatus === "resolved") return "resolved";
  if (input.issueStatus === "dismissed") return "dismissed";
  if (input.issueStatus === "acknowledged") return "acknowledged";
  return "open";
}

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
  const workflow_state = deriveWorkflowState({
    issueStatus: issue.status,
    rfiStatus: rfi?.status ?? null,
  });
  const statuses = workflowStateToStatuses(workflow_state);

  return {
    workflow_state,
    status: statuses.status,
    rfi_status: statuses.rfi_status,
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
  workflow_state: IssueWorkflowState;
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
  const statuses = workflowStateToStatuses(input.workflow_state);

  return {
    workflow_state: input.workflow_state,
    status: statuses.status,
    rfi_status: statuses.rfi_status,
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
