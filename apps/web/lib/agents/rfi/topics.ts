import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "@/lib/rag/embed";
import { searchChunks } from "@/lib/rag/search";
import type { MatchedChunk } from "@/lib/rag/types";

export interface ConstructionTopic {
  id: string;
  label: string;
  searchQuery: string;
}

export const CONSTRUCTION_TOPICS: ConstructionTopic[] = [
  { id: "doors", label: "Doors", searchQuery: "door schedule door type frame opening hardware set" },
  { id: "hardware", label: "Hardware", searchQuery: "door hardware lockset hinge closer hardware group" },
  { id: "hvac", label: "HVAC", searchQuery: "HVAC mechanical ventilation air handling ductwork" },
  { id: "electrical", label: "Electrical", searchQuery: "electrical panel conduit wiring power lighting" },
  { id: "plumbing", label: "Plumbing", searchQuery: "plumbing fixture pipe drainage water supply" },
  { id: "finishes", label: "Finishes", searchQuery: "finish paint flooring ceiling wall material" },
  { id: "dimensions", label: "Dimensions", searchQuery: "dimension elevation height width clearance tolerance" },
  { id: "schedules", label: "Schedules", searchQuery: "schedule door window finish equipment legend" },
  { id: "specifications", label: "Specifications", searchQuery: "specification section part general requirements submittal" },
];

export interface TopicChunkGroup {
  topic: ConstructionTopic;
  chunks: MatchedChunk[];
}

export async function retrieveTopicChunkGroups(
  supabase: SupabaseClient,
  projectId: string,
  chunksPerTopic = 6
): Promise<TopicChunkGroup[]> {
  const groups: TopicChunkGroup[] = [];
  const seenChunkIds = new Set<string>();

  for (const topic of CONSTRUCTION_TOPICS) {
    const embedding = await embedQuery(topic.searchQuery);
    const results = await searchChunks(supabase, {
      projectId,
      embedding,
      matchCount: chunksPerTopic,
      matchThreshold: 0.45,
    });

    const uniqueChunks = results.filter((chunk) => {
      if (seenChunkIds.has(chunk.id)) return false;
      seenChunkIds.add(chunk.id);
      return true;
    });

    if (uniqueChunks.length > 0) {
      groups.push({ topic, chunks: uniqueChunks });
    }
  }

  return groups;
}

export function formatChunksForPrompt(chunks: MatchedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const header = [
        `[Excerpt ${index + 1}]`,
        `document_id: ${chunk.document_id}`,
        `document_name: ${chunk.document_name}`,
        chunk.page_number ? `page_number: ${chunk.page_number}` : null,
        chunk.sheet_number ? `sheet_number: ${chunk.sheet_number}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      return `${header}\n${chunk.content.trim()}`;
    })
    .join("\n\n---\n\n");
}
