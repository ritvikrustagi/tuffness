import type { Citation } from "@/lib/rag/types";

export function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
          [{index + 1}] {citation.document_name}
        </p>
        <span className="shrink-0 text-xs text-zinc-500">
          {(citation.similarity * 100).toFixed(0)}% match
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {[
          citation.sheet_number && `Sheet ${citation.sheet_number}`,
          citation.page_number && `Page ${citation.page_number}`,
          citation.sheet_title,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{citation.excerpt}</p>
    </div>
  );
}
