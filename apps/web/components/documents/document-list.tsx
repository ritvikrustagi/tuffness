"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Document } from "@/lib/types/database";
import { Button } from "@/components/ui/button";

const statusColors: Record<Document["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RetryButton({ projectId, documentId }: { projectId: string; documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/documents/${documentId}/process`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Retry failed");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" onClick={retry} disabled={loading} className="mt-1 text-xs px-2 py-1">
      {loading ? "Retrying..." : "Retry"}
    </Button>
  );
}

export function DocumentList({
  documents,
  projectId,
}: {
  documents: Document[];
  projectId: string;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-zinc-500">No documents uploaded yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Pages</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Size</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Uploaded</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {doc.name}
                <div className="text-xs text-zinc-500">{doc.file_name}</div>
                {doc.error_message && (
                  <div className="mt-1 text-xs text-red-600">{doc.error_message}</div>
                )}
              </td>
              <td className="px-4 py-3 text-sm capitalize text-zinc-600 dark:text-zinc-400">
                {doc.document_type}
                {doc.discipline && (
                  <div className="text-xs text-zinc-500">{doc.discipline}</div>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {doc.page_count ?? "—"}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {formatBytes(doc.file_size_bytes)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[doc.status]}`}
                >
                  {doc.status}
                </span>
                {(doc.status === "failed" || doc.status === "pending") && (
                  <RetryButton projectId={projectId} documentId={doc.id} />
                )}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                {new Date(doc.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
