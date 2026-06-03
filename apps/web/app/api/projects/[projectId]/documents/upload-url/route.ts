import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentType } from "@/lib/types/database";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { project, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const fileName = body.fileName?.trim();
  const fileSize = body.fileSize;
  const mimeType = body.mimeType ?? "application/pdf";
  const documentType = (body.documentType ?? "other") as DocumentType;

  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  if (mimeType !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  if (typeof fileSize === "number" && fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds 100 MB limit" }, { status: 400 });
  }

  const documentId = randomUUID();
  const storagePath = `${project!.organization_id}/${projectId}/documents/${documentId}.pdf`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUploadUrl(storagePath);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    documentId,
    storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
    documentType,
  });
}
