import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const agentRunId = searchParams.get("agent_run_id");
  const status = searchParams.get("status");

  let query = supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (agentRunId) {
    query = query.eq("agent_run_id", agentRunId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data: issues, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ issues: issues ?? [] });
}
