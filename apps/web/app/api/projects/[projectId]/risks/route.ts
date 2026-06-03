import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import type { Issue } from "@/lib/types/database";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { data, error } = await supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("project_id", projectId)
    .not("risk_tier", "is", null)
    .order("risk_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ risks: (data ?? []) as Issue[] });
}
