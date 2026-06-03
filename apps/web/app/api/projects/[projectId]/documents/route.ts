import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { triggerDocumentProcessing } from "@/lib/processor/client";
import type { DocumentType } from "@/lib/types/database";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { user, project, supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const body = await request.json();

  const required = ["id", "name", "file_name", "storage_path", "mime_type", "document_type"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      id: body.id,
      project_id: projectId,
      organization_id: project!.organization_id,
      name: body.name,
      file_name: body.file_name,
      storage_path: body.storage_path,
      mime_type: body.mime_type,
      file_size_bytes: body.file_size_bytes ?? null,
      document_type: body.document_type as DocumentType,
      discipline: body.discipline ?? null,
      status: "pending",
      uploaded_by: user!.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  after(async () => {
    const result = await triggerDocumentProcessing({
      documentId: document.id,
      storagePath: document.storage_path,
      projectId,
      organizationId: project!.organization_id,
    });

    if (!result.ok) {
      console.error("Document processing failed:", result.error);
      await supabase
        .from("documents")
        .update({
          status: "failed",
          error_message: result.error?.slice(0, 500) ?? "Processing failed",
        })
        .eq("id", document.id);
    }
  });

  return NextResponse.json({ document }, { status: 201 });
}
