import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { SUBMITTAL_CATEGORIES } from "@/lib/agents/submittal/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { data: submittals, error } = await supabase
    .from("submittals")
    .select("*, documents(id, name, status, file_name, page_count)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submittals: submittals ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { user, project, supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const title = body.title?.trim();
  const documentId = body.document_id;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!documentId) {
    return NextResponse.json({ error: "document_id is required" }, { status: 400 });
  }

  const category = body.category?.trim() ?? null;
  if (category && !SUBMITTAL_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid submittal category" }, { status: 400 });
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, project_id, document_type")
    .eq("id", documentId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (docError || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (document.document_type !== "submittal") {
    await supabase.from("documents").update({ document_type: "submittal" }).eq("id", documentId);
  }

  const { data: submittal, error } = await supabase
    .from("submittals")
    .insert({
      project_id: projectId,
      organization_id: project!.organization_id,
      document_id: documentId,
      title,
      category,
      spec_section: body.spec_section ?? null,
      submittal_number: body.submittal_number ?? null,
      review_status: "pending",
      created_by: user!.id,
    })
    .select("*, documents(id, name, status, file_name, page_count)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submittal }, { status: 201 });
}
