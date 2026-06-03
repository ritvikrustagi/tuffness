import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess } from "@/lib/api/auth";
import {
  buildIssueWorkflowPatch,
  deriveWorkflowState,
  isWorkflowTransitionAllowed,
  issueStatuses,
  issueWorkflowStates,
  rfiStatuses,
} from "@/lib/issues/workflow";

const issueUpdateSchema = z.object({
  workflow_state: z.enum(issueWorkflowStates),
  status: z.enum(issueStatuses),
  rfi_status: z.enum(rfiStatuses),
  resolution_notes: z.string().max(4000),
  trade: z.string().max(100),
  discipline: z.string().max(100),
  due_date: z.string(),
  external_system_url: z.string().max(1000),
  draft_rfi: z.string().max(4000),
  external_rfi_number: z.string().max(100),
  external_url: z.string().max(1000),
  response: z.string().max(4000),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; issueId: string }> }
) {
  const { projectId, issueId } = await params;
  const { supabase, errorResponse, project, user } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const parsed = issueUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
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

  if (!isWorkflowTransitionAllowed(currentWorkflowState, parsed.data.workflow_state)) {
    return NextResponse.json(
      {
        error: `Cannot move issue from ${currentWorkflowState} to ${parsed.data.workflow_state}`,
      },
      { status: 400 }
    );
  }

  const { error: saveError } = await supabase.rpc("save_issue_workflow", {
    p_project_id: projectId,
    p_issue_id: issueId,
    p_user_id: user.id,
    p_patch: buildIssueWorkflowPatch(parsed.data),
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
