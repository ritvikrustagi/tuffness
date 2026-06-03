import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";

type SourcePageDocument = {
  id: string;
  name: string;
  file_name: string;
};

type SourcePageRow = {
  id: string;
  page_number: number;
  sheet_number: string | null;
  sheet_title: string | null;
  text_content: string | null;
  image_storage_path: string | null;
  metadata: Record<string, unknown>;
  documents: SourcePageDocument | SourcePageDocument[] | null;
};

function getJoinedDocument(document: SourcePageRow["documents"]): SourcePageDocument | null {
  if (Array.isArray(document)) return document[0] ?? null;
  return document;
}

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

  const { data: page, error: pageError } = await supabase
    .from("document_pages")
    .select(
      "id, page_number, sheet_number, sheet_title, text_content, image_storage_path, metadata, documents!inner(id, name, file_name)"
    )
    .eq("document_id", documentId)
    .eq("documents.project_id", projectId)
    .eq("page_number", parsedPageNumber)
    .maybeSingle<SourcePageRow>();

  if (pageError) {
    return NextResponse.json({ error: pageError.message }, { status: 500 });
  }

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const document = getJoinedDocument(page.documents);
  if (!document) {
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
