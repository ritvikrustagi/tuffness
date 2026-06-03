"use client";

import { useState } from "react";
import { ExternalLink, FileSearch, X } from "lucide-react";
import type { IssueEvidence } from "@/lib/types/database";
import { Button } from "@/components/ui/button";

type SourcePage = {
  id: string;
  page_number: number;
  sheet_number: string | null;
  sheet_title: string | null;
  text_content: string | null;
  image_url: string | null;
  document: {
    id: string;
    name: string;
    file_name: string;
  };
};

export function SourceViewer({
  projectId,
  evidence,
}: {
  projectId: string;
  evidence: IssueEvidence;
}) {
  const [page, setPage] = useState<SourcePage | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = Boolean(evidence.document_id && evidence.page_number);

  async function loadSource() {
    if (!canLoad || !evidence.page_number) return;
    setOpen(true);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/documents/${evidence.document_id}/pages/${evidence.page_number}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Source page unavailable");
      setPage(data.page as SourcePage);
    } catch (err) {
      setPage(null);
      setError(err instanceof Error ? err.message : "Source page unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs"
        onClick={loadSource}
        disabled={!canLoad || loading}
      >
        <FileSearch className="h-3.5 w-3.5" />
        {loading ? "Loading source..." : "View source"}
      </Button>

      {open && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {page?.document.name ?? evidence.document_name ?? "Source"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Page {page?.page_number ?? evidence.page_number}
                {page?.sheet_number ? ` · ${page.sheet_number}` : ""}
                {page?.sheet_title ? ` · ${page.sheet_title}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => setOpen(false)}
              aria-label="Close source viewer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {page?.image_url && (
            <a
              href={page.image_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open page image
            </a>
          )}

          {page?.text_content && (
            <div className="mt-3 max-h-56 overflow-auto rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {page.text_content}
            </div>
          )}

          {!loading && !error && page && !page.text_content && !page.image_url && (
            <p className="mt-3 text-sm text-zinc-500">
              This source page has metadata but no extracted text or page image yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
