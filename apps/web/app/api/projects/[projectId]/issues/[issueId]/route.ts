import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectAccess } from "@/lib/api/auth";
import { buildDraftRfiPatch, issueStatuses, rfiStatuses } from "@/lib/issues/workflow";

const issueUpdateSchema = z.object({
  status: z.enum(issueStatuses).optional(),
  resolution_notes: z.string().max(4000).nullable().optional(),
  trade: z.string().max(100).nullable().optional(),
  discipline: z.string().max(100).nullable().optional(),
  due_date: z.string().nullable().optional(),
  external_system_url: z.string().max(1000).nullable().optional(),
  draft_rfi: z.string().max(4000).nullable().optional(),
  rfi_status: z.enum(rfiStatuses).optional(),
  external_rfi_number: z.string().max(100).nullable().optional(),
  external_url: z.string().max(1000).nullable().optional(),
  response: z.string().max(4000).nullable().optional(),
});

function cleanText(value: string | null): string | null;
function cleanText(value: string | null | undefined): string | null | undefined;
function cleanText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
    .select("*, rfis(*)")
    .eq("id", issueId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existingIssue || !project || !user) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const issuePatch: Record<string, string | null> = {};
  const input = parsed.data;

  if (input.status !== undefined) issuePatch.status = input.status;
  if (input.resolution_notes !== undefined) {
    issuePatch.resolution_notes = cleanText(input.resolution_notes);
  }
  if (input.trade !== undefined) issuePatch.trade = cleanText(input.trade);
  if (input.discipline !== undefined) issuePatch.discipline = cleanText(input.discipline);
  if (input.due_date !== undefined) issuePatch.due_date = cleanText(input.due_date);
  if (input.external_system_url !== undefined) {
    issuePatch.external_system_url = cleanText(input.external_system_url);
  }
  if (input.draft_rfi !== undefined) issuePatch.draft_rfi = cleanText(input.draft_rfi);

  if (Object.keys(issuePatch).length > 0) {
    const { error: issueError } = await supabase
      .from("issues")
      .update(issuePatch)
      .eq("id", issueId)
      .eq("project_id", projectId);

    if (issueError) {
      return NextResponse.json({ error: issueError.message }, { status: 500 });
    }
  }

  const shouldUpdateRfi =
    input.rfi_status !== undefined ||
    input.external_rfi_number !== undefined ||
    input.external_url !== undefined ||
    input.response !== undefined ||
    input.draft_rfi !== undefined;

  if (shouldUpdateRfi) {
    const existingRfis = Array.isArray(existingIssue.rfis)
      ? existingIssue.rfis
      : existingIssue.rfis
        ? [existingIssue.rfis]
        : [];
    const existingRfi = existingRfis[0];
    const nextStatus = input.rfi_status ?? existingRfi?.status ?? "draft";
    const rfiPatch = {
      ...buildDraftRfiPatch({
        status: nextStatus,
        external_rfi_number: cleanText(input.external_rfi_number) ?? undefined,
        external_url: cleanText(input.external_url) ?? undefined,
        response: cleanText(input.response) ?? undefined,
      }),
      question:
        cleanText(input.draft_rfi) ??
        existingRfi?.question ??
        existingIssue.draft_rfi ??
        "Draft RFI pending human review.",
    };

    if (existingRfi?.id) {
      const { error: rfiError } = await supabase
        .from("rfis")
        .update(rfiPatch)
        .eq("id", existingRfi.id)
        .eq("project_id", projectId);

      if (rfiError) {
        return NextResponse.json({ error: rfiError.message }, { status: 500 });
      }
    } else {
      const { error: rfiError } = await supabase.from("rfis").insert({
        project_id: projectId,
        organization_id: project.organization_id,
        issue_id: issueId,
        subject: existingIssue.summary.slice(0, 200),
        created_by: user.id,
        ...rfiPatch,
      });

      if (rfiError) {
        return NextResponse.json({ error: rfiError.message }, { status: 500 });
      }
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
