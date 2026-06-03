import type { IssueStatus, RfiStatus } from "@/lib/types/database";

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

export type WorkflowSummaryBucket =
  | "open_issues"
  | "draft_rfis"
  | "submitted_rfis"
  | "answered_awaiting_closeout"
  | "closed";

type WorkflowDefinition = {
  issue_status: IssueStatus;
  rfi_status: RfiStatus;
  transitions: readonly IssueWorkflowState[];
  summary_bucket: WorkflowSummaryBucket;
  creates_rfi: boolean;
};

export const issueWorkflowModel = {
  open: {
    issue_status: "open",
    rfi_status: "draft",
    transitions: ["acknowledged", "draft_rfi", "resolved", "dismissed"],
    summary_bucket: "open_issues",
    creates_rfi: false,
  },
  acknowledged: {
    issue_status: "acknowledged",
    rfi_status: "draft",
    transitions: ["draft_rfi", "resolved", "dismissed"],
    summary_bucket: "open_issues",
    creates_rfi: false,
  },
  draft_rfi: {
    issue_status: "draft_rfi",
    rfi_status: "draft",
    transitions: ["needs_edit", "approved", "submitted", "resolved", "dismissed"],
    summary_bucket: "draft_rfis",
    creates_rfi: true,
  },
  needs_edit: {
    issue_status: "draft_rfi",
    rfi_status: "needs_edit",
    transitions: ["draft_rfi", "approved", "resolved", "dismissed"],
    summary_bucket: "draft_rfis",
    creates_rfi: true,
  },
  approved: {
    issue_status: "draft_rfi",
    rfi_status: "approved",
    transitions: ["needs_edit", "submitted", "resolved", "dismissed"],
    summary_bucket: "draft_rfis",
    creates_rfi: true,
  },
  submitted: {
    issue_status: "submitted",
    rfi_status: "submitted_externally",
    transitions: ["answered", "resolved"],
    summary_bucket: "submitted_rfis",
    creates_rfi: true,
  },
  answered: {
    issue_status: "answered",
    rfi_status: "answered",
    transitions: ["resolved"],
    summary_bucket: "answered_awaiting_closeout",
    creates_rfi: true,
  },
  resolved: {
    issue_status: "resolved",
    rfi_status: "closed",
    transitions: ["open"],
    summary_bucket: "closed",
    creates_rfi: true,
  },
  dismissed: {
    issue_status: "dismissed",
    rfi_status: "closed",
    transitions: ["open"],
    summary_bucket: "closed",
    creates_rfi: true,
  },
} as const satisfies Record<IssueWorkflowState, WorkflowDefinition>;

export type WorkflowStatuses = {
  status: IssueStatus;
  rfi_status: RfiStatus;
};

export type IssueWorkflowSummary = Record<WorkflowSummaryBucket, number> & {
  total: number;
};

export function getWorkflowStatuses(state: IssueWorkflowState): WorkflowStatuses {
  const definition = issueWorkflowModel[state];
  return {
    status: definition.issue_status,
    rfi_status: definition.rfi_status,
  };
}

export function getAllowedWorkflowTransitions(state: IssueWorkflowState): IssueWorkflowState[] {
  return [...issueWorkflowModel[state].transitions];
}

export function isWorkflowTransitionAllowed(
  current: IssueWorkflowState,
  next: IssueWorkflowState
): boolean {
  return current === next || getAllowedWorkflowTransitions(current).includes(next);
}

export function deriveWorkflowState(input: {
  issueStatus: IssueStatus;
  rfiStatus: RfiStatus | null;
}): IssueWorkflowState {
  if (input.issueStatus === "draft_rfi") {
    const rfiSpecificState = issueWorkflowStates.find((state) => {
      const definition = issueWorkflowModel[state];
      return (
        definition.issue_status === "draft_rfi" &&
        definition.rfi_status === input.rfiStatus
      );
    });
    return rfiSpecificState ?? "draft_rfi";
  }

  const issueState = issueWorkflowStates.find(
    (state) => issueWorkflowModel[state].issue_status === input.issueStatus
  );

  return issueState ?? "open";
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
    summary[issueWorkflowModel[workflowState].summary_bucket] += 1;
  }

  return summary;
}
