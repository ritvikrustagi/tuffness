import type { IssueStatus, RfiStatus } from "@/lib/types/database";
import {
  deriveWorkflowState,
  getWorkflowStatuses,
  type IssueWorkflowState,
} from "./workflow-state";

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

function cleanText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return cleanText(value);
}

export function getInitialIssueWorkflowDraft(input: {
  issue: WorkflowIssueInput;
  rfi?: WorkflowRfiInput | null;
}): IssueWorkflowDraft {
  const { issue, rfi } = input;
  const workflow_state = deriveWorkflowState({
    issueStatus: issue.status,
    rfiStatus: rfi?.status ?? null,
  });
  const statuses = getWorkflowStatuses(workflow_state);

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
  const statuses = getWorkflowStatuses(input.workflow_state);

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

export function formatOptionalLine(
  label: string,
  value: string | null | undefined
): string | null {
  const cleaned = cleanOptionalText(value);
  return cleaned ? `${label}: ${cleaned}` : null;
}
