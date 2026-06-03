import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchedChunk } from "@/lib/rag/types";

export interface SearchChunksOptions {
  projectId: string;
  embedding: number[];
  matchCount?: number;
  matchThreshold?: number;
  documentIds?: string[];
}

export async function searchChunks(
  supabase: SupabaseClient,
  options: SearchChunksOptions
): Promise<MatchedChunk[]> {
  const {
    projectId,
    embedding,
    matchCount = 8,
    matchThreshold = 0.55,
    documentIds,
  } = options;

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_project_id: projectId,
    match_count: matchCount,
    match_threshold: matchThreshold,
    filter_document_ids: documentIds?.length ? documentIds : null,
  });

  if (error) {
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return (data ?? []) as MatchedChunk[];
}
