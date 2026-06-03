import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { project, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  return NextResponse.json({ project });
}
