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

export type IssueWorkflowSummary = {
  total: number;
  open_issues: number;
  draft_rfis: number;
  submitted_rfis: number;
  answered_awaiting_closeout: number;
  closed: number;
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

function cleanOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return cleanText(value);
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

export function buildIssueWorkflowRpcPatch(input: {
  workflow_state: IssueWorkflowState;
  status?: IssueStatus;
  rfi_status?: RfiStatus;
  trade?: string | null;
  discipline?: string | null;
  due_date?: string | null;
  external_system_url?: string | null;
  external_rfi_number?: string | null;
  external_url?: string | null;
  response?: string | null;
  resolution_notes?: string | null;
  draft_rfi?: string | null;
}): Record<string, string | null> {
  const patch: Record<string, string | null> = {
    workflow_state: input.workflow_state,
  };

  const fields = [
    "status",
    "rfi_status",
    "trade",
    "discipline",
    "due_date",
    "external_system_url",
    "external_rfi_number",
    "external_url",
    "response",
    "resolution_notes",
    "draft_rfi",
  ] as const;

  for (const field of fields) {
    const value = input[field];
    if (value !== undefined) {
      patch[field] = cleanOptionalText(value) ?? null;
    }
  }

  return patch;
}

export function summarizeIssueWorkflows(
  issues: Array<{
    status: IssueStatus;
    rfis?: Array<{ status: RfiStatus }> | null;
  }>
): IssueWorkflowSummary {
  const summary: IssueWorkflowSummary = {
    total: issues.length,
    open_issues: 0,
    draft_rfis: 0,
    submitted_rfis: 0,
    answered_awaiting_closeout: 0,
    closed: 0,
  };

  for (const issue of issues) {
    const workflowState = deriveWorkflowState({
      issueStatus: issue.status,
      rfiStatus: issue.rfis?.[0]?.status ?? null,
    });

    if (workflowState === "open" || workflowState === "acknowledged") {
      summary.open_issues += 1;
    } else if (
      workflowState === "draft_rfi" ||
      workflowState === "needs_edit" ||
      workflowState === "approved"
    ) {
      summary.draft_rfis += 1;
    } else if (workflowState === "submitted") {
      summary.submitted_rfis += 1;
    } else if (workflowState === "answered") {
      summary.answered_awaiting_closeout += 1;
    } else {
      summary.closed += 1;
    }
  }

  return summary;
}

function formatOptionalLine(label: string, value: string | null | undefined): string | null {
  const cleaned = cleanOptionalText(value);
  return cleaned ? `${label}: ${cleaned}` : null;
}

export function buildDraftRfiExportText(input: {
  issue: {
    summary: string;
    description: string | null;
    severity: string;
    trade: string | null;
    discipline: string | null;
    due_date: string | null;
    evidence: IssueEvidence[];
  };
  draft: IssueWorkflowDraft;
}): string {
  const lines: string[] = [
    `Subject: ${input.issue.summary}`,
    "",
    "Question:",
    input.draft.draft_rfi.trim(),
  ];

  const metadata = [
    formatOptionalLine("Severity", input.issue.severity),
    formatOptionalLine("Trade", input.draft.trade || input.issue.trade),
    formatOptionalLine("Discipline", input.draft.discipline || input.issue.discipline),
    formatOptionalLine("Due Date", input.draft.due_date || input.issue.due_date),
  ].filter((line): line is string => Boolean(line));

  if (metadata.length > 0) {
    lines.push("", "Metadata:", ...metadata);
  }

  if (input.issue.description) {
    lines.push("", "Background:", input.issue.description.trim());
  }

  if (input.issue.evidence.length > 0) {
    lines.push("", "Evidence:");
    input.issue.evidence.forEach((item, index) => {
      const source = item.document_name ?? "Document";
      const page = item.page_number ? `, page ${item.page_number}` : "";
      const quote = item.quote ?? item.excerpt ?? "";
      lines.push(`${index + 1}. ${source}${page}: ${quote}`);
    });
  }

  const externalFields = [
    formatOptionalLine("External RFI Number", input.draft.external_rfi_number),
    formatOptionalLine("External RFI URL", input.draft.external_url),
    formatOptionalLine("External Issue URL", input.draft.external_system_url),
  ].filter((line): line is string => Boolean(line));

  if (externalFields.length > 0) {
    lines.push("", "External Tracking:", ...externalFields);
  }

  return lines.join("\n");
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
