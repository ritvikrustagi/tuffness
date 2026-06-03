import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { failAgentRun, runRfiScan, RfiScanError } from "@/lib/agents/rfi/runner";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { user, project, supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured" }, { status: 500 });
  }

  const { data: running } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("project_id", projectId)
    .eq("agent_type", "rfi_agent")
    .eq("status", "running")
    .maybeSingle();

  if (running) {
    return NextResponse.json(
      { error: "An RFI scan is already running for this project.", agent_run_id: running.id },
      { status: 409 }
    );
  }

  const { data: agentRun, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      project_id: projectId,
      organization_id: project!.organization_id,
      agent_type: "rfi_agent",
      status: "running",
      input_params: { mode: "controlled_scan" },
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
      await runRfiScan({
        supabase,
        projectId,
        organizationId: project!.organization_id,
        agentRunId: agentRun.id,
        userId: user!.id,
      });
    } catch (err) {
      const scanError =
        err instanceof RfiScanError
          ? err
          : new RfiScanError(
              err instanceof Error ? err.message : "RFI scan failed",
              "db_error"
            );
      await failAgentRun(supabase, agentRun.id, scanError);
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
