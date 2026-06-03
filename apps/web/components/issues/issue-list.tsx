"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Issue, IssueEvidence, IssueStatus, Rfi, RfiStatus } from "@/lib/types/database";
import { issueStatuses, rfiStatuses } from "@/lib/issues/workflow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const severityColors: Record<Issue["severity"], string> = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

type IssueDraft = {
  status: IssueStatus;
  rfi_status: RfiStatus;
  trade: string;
  due_date: string;
  external_rfi_number: string;
  external_url: string;
  resolution_notes: string;
  draft_rfi: string;
};

function formatIssueType(type: Issue["issue_type"]) {
  return type.replace(/_/g, " ");
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function getRfi(issue: Issue): Rfi | undefined {
  if (!issue.rfis) return undefined;
  return Array.isArray(issue.rfis) ? issue.rfis[0] : issue.rfis;
}

function evidenceText(item: IssueEvidence) {
  return item.excerpt ?? item.quote ?? "";
}

function getInitialDraft(issue: Issue): IssueDraft {
  const rfi = getRfi(issue);

  return {
    status: issue.status,
    rfi_status: rfi?.status ?? "draft",
    trade: issue.trade ?? "",
    due_date: issue.due_date ?? "",
    external_rfi_number: rfi?.external_rfi_number ?? "",
    external_url: rfi?.external_url ?? "",
    resolution_notes: issue.resolution_notes ?? "",
    draft_rfi: rfi?.question ?? issue.draft_rfi ?? "",
  };
}

export function IssueList({ projectId, issues }: { projectId: string; issues: Issue[] }) {
  const router = useRouter();
  const initialDrafts = useMemo(
    () =>
      Object.fromEntries(issues.map((issue) => [issue.id, getInitialDraft(issue)])) as Record<
        string,
        IssueDraft
      >,
    [issues]
  );
  const [drafts, setDrafts] = useState(initialDrafts);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(issueId: string, patch: Partial<IssueDraft>) {
    setDrafts((current) => ({
      ...current,
      [issueId]: {
        ...current[issueId],
        ...patch,
      },
    }));
  }

  async function saveIssue(issue: Issue) {
    const draft = drafts[issue.id];
    if (!draft) return;

    setSavingId(issue.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save issue");
      setMessage("Issue workflow saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save issue");
    } finally {
      setSavingId(null);
    }
  }

  async function copyDraft(issueId: string) {
    const draft = drafts[issueId]?.draft_rfi;
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setMessage("Draft RFI copied.");
    setError(null);
  }

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
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {issues.map((issue) => {
        const draft = drafts[issue.id] ?? getInitialDraft(issue);
        const rfi = getRfi(issue);
        const saving = savingId === issue.id;

        return (
          <Card key={issue.id}>
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

            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Issue status
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  value={draft.status}
                  onChange={(event) =>
                    updateDraft(issue.id, { status: event.target.value as IssueStatus })
                  }
                >
                  {issueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                RFI status
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  value={draft.rfi_status}
                  onChange={(event) =>
                    updateDraft(issue.id, { rfi_status: event.target.value as RfiStatus })
                  }
                >
                  {rfiStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Trade
                <Input
                  className="mt-1"
                  value={draft.trade}
                  onChange={(event) => updateDraft(issue.id, { trade: event.target.value })}
                  placeholder="doors/hardware"
                />
              </label>

              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Due date
                <Input
                  className="mt-1"
                  type="date"
                  value={draft.due_date}
                  onChange={(event) => updateDraft(issue.id, { due_date: event.target.value })}
                />
              </label>

              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                External RFI #
                <Input
                  className="mt-1"
                  value={draft.external_rfi_number}
                  onChange={(event) =>
                    updateDraft(issue.id, { external_rfi_number: event.target.value })
                  }
                  placeholder="RFI-042"
                />
              </label>

              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 lg:col-span-3">
                External URL
                <Input
                  className="mt-1"
                  value={draft.external_url}
                  onChange={(event) => updateDraft(issue.id, { external_url: event.target.value })}
                  placeholder="https://"
                />
              </label>
            </div>

            <label className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Draft RFI
              <textarea
                className="mt-1 min-h-32 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={draft.draft_rfi}
                onChange={(event) => updateDraft(issue.id, { draft_rfi: event.target.value })}
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Resolution notes
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={draft.resolution_notes}
                onChange={(event) =>
                  updateDraft(issue.id, { resolution_notes: event.target.value })
                }
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => saveIssue(issue)} disabled={saving}>
                {saving ? "Saving..." : "Save Workflow"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyDraft(issue.id)}
                disabled={!draft.draft_rfi}
              >
                Copy Draft RFI
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
