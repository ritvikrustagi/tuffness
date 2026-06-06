import { SourceViewer } from "@/components/documents/source-viewer";
import { evidenceText } from "@/components/issues/issue-display";
import { Card } from "@/components/ui/card";
import type { Issue } from "@/lib/types/database";

export function RiskEvidencePanel({
  projectId,
  issue,
}: {
  projectId: string;
  issue: Issue;
}) {
  const evidence = issue.evidence ?? [];
  if (evidence.length === 0) return null;

  return (
    <Card>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Evidence</h3>
      <div className="mt-3 space-y-3">
        {evidence.map((item, index) => (
          <div
            key={`${issue.id}-evidence-${index}`}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="break-words text-xs font-medium text-orange-700 dark:text-orange-400">
              {item.document_name ?? "Document"}
              {item.page_number ? ` · Page ${item.page_number}` : ""}
            </p>
            <p className="mt-1 break-words text-sm text-zinc-700 dark:text-zinc-300">
              {evidenceText(item) || "Evidence excerpt unavailable."}
            </p>
            <SourceViewer projectId={projectId} evidence={item} />
          </div>
        ))}
      </div>
    </Card>
  );
}
