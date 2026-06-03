import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> }
) {
  const { projectId, runId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { data: agentRun, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!agentRun) {
    return NextResponse.json({ error: "Agent run not found" }, { status: 404 });
  }

  return NextResponse.json({ agent_run: agentRun });
}
