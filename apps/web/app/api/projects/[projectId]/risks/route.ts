import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import type { Issue } from "@/lib/types/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;
  const searchParams = new URL(request.url).searchParams;

  let query = supabase
    .from("issues")
    .select("*, rfis(*)")
    .eq("project_id", projectId)
    .not("risk_tier", "is", null);

  if (searchParams.get("view") === "compliance") {
    query = query.or("compliance_impact.neq.none,required_artifact.neq.none");
  }

  for (const field of [
    "compliance_impact",
    "required_artifact",
    "spec_section",
    "drawing_sheet",
    "responsible_party",
    "responsible_trade",
  ] as const) {
    const value = searchParams.get(field);
    if (value) query = query.eq(field, value);
  }

  const { data, error } = await query
    .order("risk_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ risks: (data ?? []) as Issue[] });
}
