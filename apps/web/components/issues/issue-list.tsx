"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Issue } from "@/lib/types/database";
import {
  buildDraftRfiExportText,
  buildIssueWorkflowPatch,
  getInitialIssueWorkflowDraft,
  type IssueWorkflowDraft,
} from "@/lib/issues/workflow";
import { Card } from "@/components/ui/card";
import { IssueCard } from "@/components/issues/issue-card";
import { getRfi } from "@/components/issues/issue-display";

function buildDrafts(issues: Issue[]) {
  return Object.fromEntries(
    issues.map((issue) => [
      issue.id,
      getInitialIssueWorkflowDraft({ issue, rfi: getRfi(issue) }),
    ])
  ) as Record<string, IssueWorkflowDraft>;
}

export function IssueList({ projectId, issues }: { projectId: string; issues: Issue[] }) {
  const router = useRouter();
  const initialDrafts = useMemo(() => buildDrafts(issues), [issues]);
  const [draftOverrides, setDraftOverrides] = useState<Record<string, Partial<IssueWorkflowDraft>>>(
    {}
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(issueId: string, patch: Partial<IssueWorkflowDraft>) {
    setDraftOverrides((current) => ({
      ...current,
      [issueId]: {
        ...current[issueId],
        ...patch,
      },
    }));
  }

  async function saveIssue(issue: Issue) {
    const draft = { ...initialDrafts[issue.id], ...draftOverrides[issue.id] };
    if (!draft) return;

    setSavingId(issue.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildIssueWorkflowPatch(draft)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save issue");
      setMessage("Issue workflow saved.");
      setDraftOverrides((current) => {
        const next = { ...current };
        delete next[issue.id];
        return next;
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save issue");
    } finally {
      setSavingId(null);
    }
  }

  async function copyDraft(issueId: string) {
    const issue = issues.find((item) => item.id === issueId);
    if (!issue) return;
    const draft = { ...initialDrafts[issueId], ...draftOverrides[issueId] };
    if (!draft?.draft_rfi) return;
    await navigator.clipboard.writeText(buildDraftRfiExportText({ issue, draft }));
    setMessage("Draft RFI copied with evidence.");
    setError(null);
  }

  function exportDraft(issueId: string) {
    const issue = issues.find((item) => item.id === issueId);
    if (!issue) return;
    const draft = { ...initialDrafts[issueId], ...draftOverrides[issueId] };
    if (!draft?.draft_rfi) return;

    const blob = new Blob([buildDraftRfiExportText({ issue, draft })], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeSubject = issue.summary.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${safeSubject || "draft-rfi"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Draft RFI exported.");
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

      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          projectId={projectId}
          issue={issue}
          draft={{ ...initialDrafts[issue.id], ...draftOverrides[issue.id] }}
          saving={savingId === issue.id}
          onDraftChange={(patch) => updateDraft(issue.id, patch)}
          onSave={() => saveIssue(issue)}
          onCopy={() => copyDraft(issue.id)}
          onExport={() => exportDraft(issue.id)}
        />
      ))}
    </div>
  );
}
