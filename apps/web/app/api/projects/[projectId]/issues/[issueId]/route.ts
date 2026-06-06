import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import {
  buildOptionalIssueWorkflowRpcPatch,
  deriveWorkflowState,
  getWorkflowStatuses,
  type IssueWorkflowState,
  isWorkflowTransitionAllowed,
} from "@/lib/issues/workflow";
import {
  safeParseIssueUpdateRequest,
} from "@/lib/issues/update-request";
import { buildRiskMetadataRpcPatch } from "@/lib/risks/patch";

const isValidDateString = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; issueId: string }> }
) {
  const { projectId, issueId } = await params;
  const { supabase, errorResponse, project, user } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const parsed = safeParseIssueUpdateRequest(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const {
    riskPatch,
    workflowPatch,
    hasRiskPatch,
    markReviewed,
    hasWorkflowFields,
    hasAnyPatch,
  } = parsed.data;

  if (!hasAnyPatch) {
    return NextResponse.json({ error: "No issue fields provided" }, { status: 400 });
  }

  const { data: existingIssue, error: existingError } = await supabase
    .from("issues")
    .select("id, project_id, status, rfis(status)")
    .eq("id", issueId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existingIssue || !project || !user) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const existingRfis = Array.isArray(existingIssue.rfis)
    ? existingIssue.rfis
    : existingIssue.rfis
      ? [existingIssue.rfis]
      : [];
  const currentWorkflowState = deriveWorkflowState({
    issueStatus: existingIssue.status,
    rfiStatus: existingRfis[0]?.status ?? null,
  });

  if (
    workflowPatch.workflow_state &&
    !isWorkflowTransitionAllowed(currentWorkflowState, workflowPatch.workflow_state)
  ) {
    return NextResponse.json(
      {
        error: `Cannot move issue from ${currentWorkflowState} to ${workflowPatch.workflow_state}`,
      },
      { status: 400 }
    );
  }

  const nextWorkflowState: IssueWorkflowState = workflowPatch.workflow_state ?? currentWorkflowState;
  const derivedStatuses = getWorkflowStatuses(nextWorkflowState);

  if (workflowPatch.status && workflowPatch.status !== derivedStatuses.status) {
    return NextResponse.json({ error: "status must match workflow_state" }, { status: 400 });
  }

  if (workflowPatch.rfi_status && workflowPatch.rfi_status !== derivedStatuses.rfi_status) {
    return NextResponse.json({ error: "rfi_status must match workflow_state" }, { status: 400 });
  }

  if (workflowPatch.due_date && !isValidDateString(workflowPatch.due_date)) {
    return NextResponse.json(
      { error: "due_date must be a valid YYYY-MM-DD date" },
      { status: 400 }
    );
  }

  const workflowRpcPatch = buildOptionalIssueWorkflowRpcPatch({
    hasWorkflowFields,
    ...workflowPatch,
    workflow_state: nextWorkflowState,
  });

  const { error: saveError } = hasRiskPatch || markReviewed
    ? await supabase.rpc("save_issue_with_risk_metadata", {
        p_project_id: projectId,
        p_issue_id: issueId,
        p_user_id: user.id,
        p_workflow_patch: workflowRpcPatch,
        p_risk_patch: buildRiskMetadataRpcPatch(riskPatch),
        p_mark_reviewed: markReviewed,
      })
    : await supabase.rpc("save_issue_workflow", {
        p_project_id: projectId,
        p_issue_id: issueId,
        p_user_id: user.id,
        p_patch: workflowRpcPatch,
      });

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  const { data: issue, error } = await supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("id", issueId)
    .eq("project_id", projectId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ issue });
}
