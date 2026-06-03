import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; documentId: string; pageNumber: string }>;
  }
) {
  const { projectId, documentId, pageNumber } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const parsedPageNumber = Number(pageNumber);
  if (!Number.isInteger(parsedPageNumber) || parsedPageNumber < 1) {
    return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, name, file_name, project_id")
    .eq("id", documentId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: page, error: pageError } = await supabase
    .from("document_pages")
    .select("id, page_number, sheet_number, sheet_title, text_content, image_storage_path, metadata")
    .eq("document_id", documentId)
    .eq("page_number", parsedPageNumber)
    .maybeSingle();

  if (pageError) {
    return NextResponse.json({ error: pageError.message }, { status: 500 });
  }

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  let image_url: string | null = null;
  if (page.image_storage_path) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(page.image_storage_path, 60 * 10);
    image_url = data?.signedUrl ?? null;
  }

  return NextResponse.json({
    page: {
      ...page,
      image_url,
      document: {
        id: document.id,
        name: document.name,
        file_name: document.file_name,
      },
    },
  });
}
