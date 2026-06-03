import type { Issue, IssueEvidence, Rfi } from "@/lib/types/database";
import { Card } from "@/components/ui/card";

const severityColors: Record<Issue["severity"], string> = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

function formatIssueType(type: Issue["issue_type"]) {
  return type.replace(/_/g, " ");
}

function getRfi(issue: Issue): Rfi | undefined {
  if (!issue.rfis) return undefined;
  return Array.isArray(issue.rfis) ? issue.rfis[0] : issue.rfis;
}

function evidenceText(item: IssueEvidence) {
  return item.excerpt ?? item.quote ?? "";
}

export function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <Card>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No potential RFIs yet. Click &quot;Find Potential RFIs&quot; to scan processed project
          documents. All results require human review before submission.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {issues.map((issue) => {
        const rfi = getRfi(issue);

        return (
          <Card key={issue.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{issue.summary}</h3>
                <p className="mt-1 text-xs capitalize text-zinc-500">
                  {formatIssueType(issue.issue_type)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityColors[issue.severity]}`}
                >
                  {issue.severity}
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-800">
                  issue: {issue.status}
                </span>
                {rfi && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium capitalize text-purple-800">
                    rfi: {rfi.status}
                  </span>
                )}
              </div>
            </div>

            {issue.evidence?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Evidence
                </p>
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

            {(rfi?.question || issue.draft_rfi) && (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Draft RFI
                </p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  {rfi?.question ?? issue.draft_rfi}
                </p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
