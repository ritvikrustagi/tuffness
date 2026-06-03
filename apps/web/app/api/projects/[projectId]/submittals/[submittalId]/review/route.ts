import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import {
  failSubmittalReviewRun,
  runSubmittalReview,
  SubmittalReviewError,
} from "@/lib/agents/submittal/runner";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; submittalId: string }> }
) {
  const { projectId, submittalId } = await params;
  const { user, supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured" }, { status: 500 });
  }

  const { data: submittal } = await supabase
    .from("submittals")
    .select("id, document_id, documents(status)")
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!submittal) {
    return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
  }

  if (!submittal.document_id) {
    return NextResponse.json({ error: "No submittal document uploaded" }, { status: 400 });
  }

  const doc = submittal.documents as { status?: string } | null;
  if (!doc || doc.status !== "ready") {
    return NextResponse.json(
      { error: "Submittal document is not processed yet. Wait for processing to complete." },
      { status: 400 }
    );
  }

  const { data: running } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("project_id", projectId)
    .eq("agent_type", "submittal_review")
    .eq("status", "running")
    .maybeSingle();

  if (running) {
    return NextResponse.json(
      { error: "A submittal review is already running.", agent_run_id: running.id },
      { status: 409 }
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .single();

  const { data: agentRun, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      project_id: projectId,
      organization_id: project!.organization_id,
      agent_type: "submittal_review",
      status: "running",
      input_params: { submittal_id: submittalId, mode: "controlled_review" },
      triggered_by: user!.id,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (runError || !agentRun) {
    return NextResponse.json(
      { error: runError?.message ?? "Failed to create agent run" },
      { status: 500 }
    );
  }

  after(async () => {
    try {
      await runSubmittalReview({
        supabase,
        projectId,
        submittalId,
        agentRunId: agentRun.id,
        userId: user!.id,
      });
    } catch (err) {
      const reviewError =
        err instanceof SubmittalReviewError
          ? err
          : new SubmittalReviewError(
              err instanceof Error ? err.message : "Submittal review failed",
              "db_error"
            );
      await failSubmittalReviewRun(supabase, agentRun.id, reviewError);
    }
  });

  return NextResponse.json(
    {
      agent_run_id: agentRun.id,
      status: "running",
    },
    { status: 202 }
  );
}
