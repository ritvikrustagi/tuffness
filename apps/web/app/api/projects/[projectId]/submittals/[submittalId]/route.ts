import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; submittalId: string }> }
) {
  const { projectId, submittalId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { data: submittal, error } = await supabase
    .from("submittals")
    .select("*, documents(id, name, status, file_name, page_count)")
    .eq("id", submittalId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!submittal) {
    return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
  }

  return NextResponse.json({ submittal });
}
