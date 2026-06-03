import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { triggerDocumentProcessing } from "@/lib/processor/client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> }
) {
  const { projectId, documentId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await supabase
    .from("documents")
    .update({ status: "processing", error_message: null })
    .eq("id", documentId);

  const result = await triggerDocumentProcessing({
    documentId: document.id,
    storagePath: document.storage_path,
    projectId,
    organizationId: document.organization_id,
  });

  if (!result.ok) {
    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message: result.error?.slice(0, 500) ?? "Processing failed",
      })
      .eq("id", documentId);

    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const { data: updated } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  return NextResponse.json({ document: updated });
}
