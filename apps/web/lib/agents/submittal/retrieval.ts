import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "@/lib/rag/embed";
import { searchChunks } from "@/lib/rag/search";
import type { MatchedChunk } from "@/lib/rag/types";
import type { SubmittalCategory } from "@/lib/agents/submittal/schema";

const CATEGORY_SEARCH_QUERIES: Record<SubmittalCategory, string> = {
  HVAC: "HVAC mechanical equipment specification requirements submittal",
  electrical: "electrical panel conduit wiring specification requirements",
  plumbing: "plumbing fixture pipe drainage specification requirements",
  "doors/hardware": "door hardware frame lockset specification requirements",
  finishes: "finish paint flooring ceiling specification requirements",
  structural: "structural steel concrete specification requirements",
  other: "general specification requirements product submittal compliance",
};

export interface SubmittalChunkRow {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
  document_pages: {
    page_number: number;
    sheet_number: string | null;
  } | null;
  documents: {
    name: string;
  } | null;
}

export interface ReviewContext {
  submittalChunks: SubmittalChunkRow[];
  specChunks: MatchedChunk[];
  specDocumentIds: string[];
}

export async function retrieveReviewContext(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    submittalDocumentId: string;
    category: SubmittalCategory | null;
    submittalTitle: string;
  }
): Promise<ReviewContext> {
  const { data: specDocs, error: specDocsError } = await supabase
    .from("documents")
    .select("id, name, document_type, discipline")
    .eq("project_id", params.projectId)
    .eq("status", "ready")
    .eq("document_type", "spec");

  if (specDocsError) {
    throw new Error(specDocsError.message);
  }

  const specDocumentIds = (specDocs ?? []).map((doc) => doc.id);
  if (specDocumentIds.length === 0) {
    throw new Error("No specification documents found for this project.");
  }

  const { data: submittalChunks, error: submittalChunksError } = await supabase
    .from("chunks")
    .select(
      "id, document_id, content, chunk_index, metadata, document_pages(page_number, sheet_number), documents(name)"
    )
    .eq("document_id", params.submittalDocumentId)
    .order("chunk_index", { ascending: true })
    .limit(12);

  if (submittalChunksError) {
    throw new Error(submittalChunksError.message);
  }

  if (!submittalChunks?.length) {
    throw new Error("No processed submittal chunks found.");
  }

  const category = params.category ?? "other";
  const submittalPreview = submittalChunks
    .slice(0, 3)
    .map((chunk) => chunk.content)
    .join(" ")
    .slice(0, 500);

  const searchText = `${params.submittalTitle}. ${CATEGORY_SEARCH_QUERIES[category]}. ${submittalPreview}`;
  const embedding = await embedQuery(searchText);

  const specChunks = await searchChunks(supabase, {
    projectId: params.projectId,
    embedding,
    matchCount: 10,
    matchThreshold: 0.5,
    documentIds: specDocumentIds,
  });

  if (specChunks.length === 0) {
    throw new Error("No relevant specification chunks found for this submittal.");
  }

  return {
    submittalChunks: normalizeSubmittalChunks(submittalChunks ?? []),
    specChunks,
    specDocumentIds,
  };
}

function normalizeSubmittalChunks(rows: Record<string, unknown>[]): SubmittalChunkRow[] {
  return rows.map((row) => {
    const page = row.document_pages as
      | { page_number: number; sheet_number: string | null }
      | { page_number: number; sheet_number: string | null }[]
      | null;
    const doc = row.documents as { name: string } | { name: string }[] | null;

    return {
      id: String(row.id),
      document_id: String(row.document_id),
      content: String(row.content),
      chunk_index: Number(row.chunk_index),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      document_pages: Array.isArray(page) ? page[0] ?? null : page,
      documents: Array.isArray(doc) ? doc[0] ?? null : doc,
    };
  });
}

export function formatSubmittalChunksForPrompt(chunks: SubmittalChunkRow[]): string {
  return chunks
    .map((chunk, index) => {
      const pageNumber = chunk.document_pages?.page_number ?? "unknown";
      const docName = chunk.documents?.name ?? "Submittal";
      return `[Submittal Excerpt ${index + 1}] document_id: ${chunk.document_id} | document_name: ${docName} | page_number: ${pageNumber}\n${chunk.content.trim()}`;
    })
    .join("\n\n---\n\n");
}

export function formatSpecChunksForPrompt(chunks: MatchedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      return `[Spec Excerpt ${index + 1}] document_id: ${chunk.document_id} | document_name: ${chunk.document_name} | page_number: ${chunk.page_number ?? "unknown"}\n${chunk.content.trim()}`;
    })
    .join("\n\n---\n\n");
}
