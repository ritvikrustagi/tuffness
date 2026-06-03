export interface MatchedChunk {
  id: string;
  document_id: string;
  document_page_id: string | null;
  content: string;
  content_type: string;
  metadata: Record<string, unknown>;
  similarity: number;
  page_number: number | null;
  sheet_number: string | null;
  sheet_title: string | null;
  document_name: string;
}

export interface Citation {
  chunk_id: string;
  document_id: string;
  document_name: string;
  page_number: number | null;
  sheet_number: string | null;
  sheet_title: string | null;
  excerpt: string;
  similarity: number;
}

export interface ChatRequest {
  message: string;
  document_ids?: string[];
}

export interface ChatStreamEvent {
  type: "text" | "citations" | "error";
  content?: string;
  citations?: Citation[];
  error?: string;
}

export function toCitation(chunk: MatchedChunk): Citation {
  return {
    chunk_id: chunk.id,
    document_id: chunk.document_id,
    document_name: chunk.document_name,
    page_number: chunk.page_number,
    sheet_number: chunk.sheet_number,
    sheet_title: chunk.sheet_title,
    excerpt: truncateExcerpt(chunk.content, 280),
    similarity: chunk.similarity,
  };
}

function truncateExcerpt(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength)}…`;
}
