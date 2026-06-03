import type { Issue } from "@/lib/types/database";
import type { IssueWorkflowDraft } from "@/lib/issues/workflow";
import { Card } from "@/components/ui/card";
import {
  evidenceText,
  formatIssueType,
  formatStatus,
  getRfi,
  severityColors,
} from "@/components/issues/issue-display";
import { IssueWorkflowForm } from "@/components/issues/issue-workflow-form";

export function IssueCard({
  issue,
  draft,
  saving,
  onDraftChange,
  onSave,
  onCopy,
}: {
  issue: Issue;
  draft: IssueWorkflowDraft;
  saving: boolean;
  onDraftChange: (patch: Partial<IssueWorkflowDraft>) => void;
  onSave: () => void;
  onCopy: () => void;
}) {
  const rfi = getRfi(issue);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{issue.summary}</h3>
          <p className="mt-1 text-xs capitalize text-zinc-500">
            {formatIssueType(issue.issue_type)}
            {issue.confidence !== null && ` · ${(issue.confidence * 100).toFixed(0)}% confidence`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityColors[issue.severity]}`}
          >
            {issue.severity}
          </span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-800">
            issue: {formatStatus(issue.status)}
          </span>
          {rfi && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium capitalize text-purple-800">
              rfi: {formatStatus(rfi.status)}
            </span>
          )}
        </div>
      </div>

      {issue.description && (
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{issue.description}</p>
      )}

      {issue.recommended_action && (
        <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Next action: {issue.recommended_action}
        </p>
      )}

      {issue.evidence?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Evidence</p>
          <div className="mt-2 space-y-2">
            {issue.evidence.map((item, index) => (
              <div
                key={`${issue.id}-evidence-${index}`}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                  {item.document_name ?? "Document"}
                  {item.page_number ? ` · Page ${item.page_number}` : ""}
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {evidenceText(item)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <IssueWorkflowForm
        issue={issue}
        draft={draft}
        saving={saving}
        onChange={onDraftChange}
        onSave={onSave}
        onCopy={onCopy}
      />
    </Card>
  );
}
