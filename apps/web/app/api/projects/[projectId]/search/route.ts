import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/api/auth";
import { embedQuery } from "@/lib/rag/embed";
import { searchChunks } from "@/lib/rag/search";
import { toCitation } from "@/lib/rag/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { supabase, errorResponse } = await requireProjectAccess(projectId);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "q query parameter is required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured" }, { status: 500 });
  }

  const documentIds = searchParams.get("document_ids")?.split(",").filter(Boolean);
  const matchCount = Number(searchParams.get("limit") ?? "8");
  const matchThreshold = Number(searchParams.get("threshold") ?? "0.55");

  try {
    const embedding = await embedQuery(query);
    const chunks = await searchChunks(supabase, {
      projectId,
      embedding,
      matchCount: Number.isFinite(matchCount) ? matchCount : 8,
      matchThreshold: Number.isFinite(matchThreshold) ? matchThreshold : 0.55,
      documentIds,
    });

    return NextResponse.json({
      query,
      results: chunks.map((chunk) => toCitation(chunk)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
