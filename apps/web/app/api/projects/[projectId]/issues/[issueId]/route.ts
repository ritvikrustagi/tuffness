import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess } from "@/lib/api/auth";
import {
  buildIssueWorkflowRpcPatch,
  deriveWorkflowState,
  type IssueWorkflowState,
  isWorkflowTransitionAllowed,
  issueStatuses,
  issueWorkflowStates,
  rfiStatuses,
} from "@/lib/issues/workflow";
import { riskMetadataPatchSchema, type RiskMetadataPatch } from "@/lib/risks/validation";

const workflowUpdateSchema = z.object({
  workflow_state: z.enum(issueWorkflowStates).optional(),
  status: z.enum(issueStatuses).optional(),
  rfi_status: z.enum(rfiStatuses).optional(),
  subject: z.string().max(200).nullable().optional(),
  resolution_notes: z.string().max(4000).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  trade: z.string().max(100).nullable().optional(),
  discipline: z.string().max(100).nullable().optional(),
  due_date: z.string().nullable().optional(),
  external_system_url: z.string().max(1000).nullable().optional(),
  draft_rfi: z.string().max(4000).nullable().optional(),
  external_rfi_number: z.string().max(100).nullable().optional(),
  external_url: z.string().max(1000).nullable().optional(),
  response: z.string().max(4000).nullable().optional(),
});

const issueUpdateSchema = workflowUpdateSchema.extend(riskMetadataPatchSchema.shape);

type WorkflowPatch = z.infer<typeof workflowUpdateSchema>;

const hasRiskMetadataPatch = (patch: RiskMetadataPatch) =>
  Object.values(patch).some((value) => value !== undefined);

const hasWorkflowPatch = (patch: WorkflowPatch) =>
  Object.values(patch).some((value) => value !== undefined);

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

  const riskPatch = riskMetadataPatchSchema.parse(parsed.data);
  const workflowPatch = workflowUpdateSchema.parse(parsed.data);
  const hasRiskPatch = hasRiskMetadataPatch(riskPatch);
  const hasWorkflowFields = hasWorkflowPatch(workflowPatch);

  if (!hasRiskPatch && !hasWorkflowFields) {
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

  if (hasRiskPatch) {
    const { error: riskUpdateError } = await supabase
      .from("issues")
      .update({
        ...riskPatch,
        human_reviewed_at: new Date().toISOString(),
        human_reviewed_by: user.id,
      })
      .eq("id", issueId)
      .eq("project_id", projectId);

    if (riskUpdateError) {
      return NextResponse.json({ error: riskUpdateError.message }, { status: 500 });
    }
  }

  if (hasWorkflowFields) {
    const workflowState: IssueWorkflowState = workflowPatch.workflow_state ?? currentWorkflowState;
    const { error: saveError } = await supabase.rpc("save_issue_workflow", {
      p_project_id: projectId,
      p_issue_id: issueId,
      p_user_id: user.id,
      p_patch: buildIssueWorkflowRpcPatch({
        ...workflowPatch,
        workflow_state: workflowState,
      }),
    });

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }
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
